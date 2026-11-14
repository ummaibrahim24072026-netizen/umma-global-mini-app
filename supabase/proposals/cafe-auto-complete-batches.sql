BEGIN;

-- Both the kitchen and the scheduler post the batch using the same stock rules.
-- The caller holds the location advisory lock and locks orders before inventory.
CREATE FUNCTION umma_private.cafe_finish_batch(
  p_batch public.inventory,
  p_quantity integer,
  p_actor bigint
) RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.inventory
  SET quantity = CASE WHEN ready_stock_confirmed THEN quantity ELSE reserved_quantity END + p_quantity,
      reserved_quantity = reserved_quantity + planned_reserved_quantity,
      ready_stock_confirmed = true,
      ready_stock_state = 'ready',
      is_available = true,
      planned_quantity = 0,
      planned_reserved_quantity = 0,
      planned_ready_at = NULL,
      plan_revision = NULL,
      updated_at = now()
  WHERE id = p_batch.id AND plan_revision = p_batch.plan_revision;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Партия уже завершена или отменена';
  END IF;

  UPDATE public.cafe_order_items AS item
  SET ready_stock_state = 'reserved'
  FROM public.cafe_orders AS orders
  WHERE orders.id = item.order_id AND orders.location_id = p_batch.location_id
    AND item.product_id = p_batch.product_id
    AND item.preorder_batch_revision = p_batch.plan_revision
    AND item.ready_stock_state = 'planned';

  INSERT INTO public.cafe_inventory_movements
    (location_id, product_id, actor_telegram_id, movement_type, quantity, note)
  VALUES
    (p_batch.location_id, p_batch.product_id, p_actor, 'stock_set', p_quantity,
     CASE WHEN p_actor IS NULL THEN 'Партия готова по расписанию: добавлено порций'
          ELSE 'Партия готова: добавлено порций' END);
END;
$$;

CREATE FUNCTION umma_private.cafe_release_ready_preorders(p_location uuid)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  UPDATE public.cafe_orders AS orders
  SET preorder_waiting = false,
      status = CASE WHEN orders.payment_status = 'paid' OR NOT orders.requires_prepayment
                    THEN 'preparing' ELSE 'pending' END,
      updated_at = now()
  WHERE orders.location_id = p_location AND orders.preorder_waiting
    AND orders.status NOT IN ('completed', 'cancelled')
    AND NOT EXISTS (
      SELECT 1 FROM public.cafe_order_items AS item
      WHERE item.order_id = orders.id AND item.ready_stock_state = 'planned'
    );
$$;

-- Preserve the deployed RPC, including staff authorization and request replay.
DO $$
DECLARE
  body text := pg_get_functiondef('public.cafe_ready_plan(bigint,uuid,uuid,text,jsonb)'::regprocedure);
  finish_start integer := strpos(body, '    UPDATE inventory SET quantity=');
  finish_end integer := strpos(body, E'\n   ELSE UPDATE inventory SET planned_quantity=0');
  release_start integer;
  release_end integer;
BEGIN
  IF finish_start = 0 OR finish_end <= finish_start THEN
    RAISE EXCEPTION 'Unexpected cafe_ready_plan finish branch';
  END IF;
  body := overlay(body placing '    PERFORM umma_private.cafe_finish_batch(row,qty,p_actor);'
                  from finish_start for finish_end - finish_start);
  release_start := strpos(body, ' UPDATE cafe_orders o SET preorder_waiting=false');
  release_end := strpos(body, E'\n result:=public.cafe_ready_list');
  IF release_start = 0 OR release_end <= release_start THEN
    RAISE EXCEPTION 'Unexpected cafe_ready_plan preorder release';
  END IF;
  EXECUTE overlay(body placing ' PERFORM umma_private.cafe_release_ready_preorders(p_location);'
                  from release_start for release_end - release_start);
END;
$$;

CREATE FUNCTION umma_private.cafe_finish_due_batches()
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  cutoff constant timestamptz := statement_timestamp();
  cafe_id uuid;
  batch public.inventory%ROWTYPE;
  finished integer := 0;
BEGIN
  FOR cafe_id IN
    SELECT l.id FROM public.locations AS l
    WHERE l.is_active AND l.location_type IN ('cafe', 'restaurant')
      AND EXISTS (
        SELECT 1 FROM public.inventory AS i
        WHERE i.location_id = l.id AND i.planned_ready_at <= cutoff
          AND i.planned_quantity > 0 AND i.plan_revision IS NOT NULL
      )
    ORDER BY l.id
  LOOP
    IF NOT pg_try_advisory_xact_lock(hashtextextended('preorder:' || cafe_id, 0)) THEN
      CONTINUE;
    END IF;

    -- Cancellation also locks the parent order before changing stock.
    PERFORM 1 FROM public.cafe_orders AS orders
    WHERE orders.location_id = cafe_id AND EXISTS (
      SELECT 1 FROM public.cafe_order_items AS item
      JOIN public.inventory AS i ON i.location_id = cafe_id AND i.product_id = item.product_id
        AND i.plan_revision = item.preorder_batch_revision
      WHERE item.order_id = orders.id AND item.ready_stock_state = 'planned'
        AND i.planned_ready_at <= cutoff AND i.planned_quantity > 0
    )
    ORDER BY orders.id FOR UPDATE;

    FOR batch IN
      SELECT i.* FROM public.inventory AS i
      WHERE i.location_id = cafe_id AND i.planned_ready_at <= cutoff
        AND i.planned_quantity > 0 AND i.plan_revision IS NOT NULL
      ORDER BY i.product_id FOR UPDATE
    LOOP
      PERFORM umma_private.cafe_finish_batch(batch, batch.planned_quantity, NULL);
      finished := finished + 1;
    END LOOP;

    PERFORM umma_private.cafe_release_ready_preorders(cafe_id);
  END LOOP;

  RETURN finished;
END;
$$;

REVOKE ALL ON FUNCTION umma_private.cafe_finish_batch(public.inventory, integer, bigint),
  umma_private.cafe_release_ready_preorders(uuid), umma_private.cafe_finish_due_batches()
  FROM PUBLIC, anon, authenticated, service_role;

SELECT cron.schedule('umma-cafe-finish-due-batches', '5 seconds',
                     'SELECT umma_private.cafe_finish_due_batches()');

COMMIT;
