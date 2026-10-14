-- Isolated QA objects only. Requires explicit owner approval before execution.
-- No production records, credentials or application objects are changed.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('umma_qa_20261013','umma_qa_20261013_private')) THEN
  RAISE EXCEPTION 'QA schema already exists; inspect it instead of overwriting';
 END IF;
END $$;
CREATE SCHEMA umma_qa_20261013;
SET LOCAL search_path=umma_qa_20261013,pg_catalog;
-- Read-only schema snapshot from Supabase 2026-10-13. No production rows or secrets.
CREATE TABLE umma_qa_20261013."stock_movements" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "stock_item_id" uuid NOT NULL,
 "movement_type" text NOT NULL,
 "quantity_delta" numeric(14,3) NOT NULL,
 "unit_cost_vnd" numeric(18,4) DEFAULT 0 NOT NULL,
 "source_type" text,
 "source_id" uuid,
 "actor_telegram_id" bigint,
 "note" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."umma_runtime_settings" (
 "id" boolean DEFAULT true NOT NULL,
 "inventory_control_enabled" boolean DEFAULT false NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_by_telegram_id" bigint,
 "data_stage" text DEFAULT 'temporary_test'::text NOT NULL
);
CREATE TABLE umma_qa_20261013."cafe_transfer_proofs" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "order_id" uuid NOT NULL,
 "customer_telegram_id" bigint NOT NULL,
 "bank_country" text NOT NULL,
 "file_path" text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "reviewed_by_telegram_id" bigint,
 "reviewed_at" timestamp with time zone,
 "review_status" text DEFAULT 'pending'::text NOT NULL
);
CREATE TABLE umma_qa_20261013."profiles" (
 "telegram_id" bigint NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "first_name" text,
 "last_name" text,
 "username" text
);
CREATE TABLE umma_qa_20261013."user_settings" (
 "telegram_id" bigint NOT NULL,
 "language" text DEFAULT 'en'::text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."user_profiles" (
 "telegram_id" bigint NOT NULL,
 "bio" text,
 "country" text,
 "city" text,
 "avatar_url" text,
 "is_public" boolean DEFAULT true NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."cafe_cash_handovers" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "from_telegram_id" bigint NOT NULL,
 "to_telegram_id" bigint NOT NULL,
 "amount_vnd" integer NOT NULL,
 "handover_status" text DEFAULT 'pending'::text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "accepted_at" timestamp with time zone,
 "accepted_by_telegram_id" bigint,
 "note" text
);
CREATE TABLE umma_qa_20261013."cafe_payment_receipts" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "order_id" uuid NOT NULL,
 "location_id" uuid NOT NULL,
 "collected_by_telegram_id" bigint NOT NULL,
 "payment_method" text NOT NULL,
 "amount_vnd" integer NOT NULL,
 "receipt_status" text DEFAULT 'confirmed'::text NOT NULL,
 "collected_at" timestamp with time zone DEFAULT now() NOT NULL,
 "note" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "tendered_amount_vnd" integer,
 "change_given_vnd" integer
);
CREATE TABLE umma_qa_20261013."locations" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "name" text NOT NULL,
 "location_type" text NOT NULL,
 "address" text,
 "city" text,
 "country" text DEFAULT 'Vietnam'::text,
 "latitude" numeric,
 "longitude" numeric,
 "phone" text,
 "is_active" boolean DEFAULT true NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."categories" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "name_ru" text NOT NULL,
 "name_vi" text NOT NULL,
 "name_en" text NOT NULL,
 "category_type" text NOT NULL,
 "sort_order" integer DEFAULT 0 NOT NULL,
 "is_active" boolean DEFAULT true NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."products" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "category_id" uuid,
 "name_ru" text NOT NULL,
 "name_vi" text NOT NULL,
 "name_en" text NOT NULL,
 "description_ru" text,
 "description_vi" text,
 "description_en" text,
 "product_type" text NOT NULL,
 "price_vnd" integer NOT NULL,
 "weight_value" numeric,
 "weight_unit" text,
 "image_url" text,
 "sku" text,
 "sort_order" integer DEFAULT 0 NOT NULL,
 "is_active" boolean DEFAULT true NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."inventory" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "product_id" uuid NOT NULL,
 "location_id" uuid NOT NULL,
 "quantity" numeric DEFAULT 0 NOT NULL,
 "reserved_quantity" numeric DEFAULT 0 NOT NULL,
 "is_available" boolean DEFAULT true NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "price_vnd" integer
);
CREATE TABLE umma_qa_20261013."translation_messages" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "sender_telegram_id" bigint,
 "receiver_telegram_id" bigint,
 "source_language" text NOT NULL,
 "target_language" text NOT NULL,
 "source_text" text NOT NULL,
 "translated_text" text NOT NULL,
 "translation_type" text DEFAULT 'text'::text NOT NULL,
 "provider" text DEFAULT 'openai'::text NOT NULL,
 "model" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."translation_cache" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "source_language" text NOT NULL,
 "target_language" text NOT NULL,
 "source_text" text NOT NULL,
 "translated_text" text NOT NULL,
 "provider" text DEFAULT 'openai'::text NOT NULL,
 "model" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."voice_sessions" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "client_telegram_id" bigint,
 "staff_telegram_id" bigint,
 "client_language" text NOT NULL,
 "staff_language" text NOT NULL,
 "mode" text DEFAULT 'dialogue'::text NOT NULL,
 "openai_session_id" text,
 "status" text DEFAULT 'active'::text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "ended_at" timestamp with time zone
);
CREATE TABLE umma_qa_20261013."voice_turns" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "session_id" uuid NOT NULL,
 "speaker_telegram_id" bigint,
 "source_language" text NOT NULL,
 "target_language" text NOT NULL,
 "original_text" text,
 "translated_text" text,
 "audio_url" text,
 "turn_number" integer NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."translation_settings" (
 "telegram_id" bigint NOT NULL,
 "language" text DEFAULT 'en'::text NOT NULL,
 "auto_translate" boolean DEFAULT true NOT NULL,
 "auto_voice_translate" boolean DEFAULT true NOT NULL,
 "voice_enabled" boolean DEFAULT true NOT NULL,
 "preferred_voice" text DEFAULT 'marin'::text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."telegram_users" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "telegram_id" bigint NOT NULL,
 "first_name" text,
 "last_name" text,
 "username" text,
 "language_code" text,
 "photo_url" text,
 "is_active" boolean DEFAULT true NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
 "role" text DEFAULT 'user'::text NOT NULL
);
CREATE TABLE umma_qa_20261013."suppliers" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "name" text NOT NULL,
 "contact_name" text,
 "phone" text,
 "email" text,
 "address" text,
 "notes" text,
 "is_halal_verified" boolean DEFAULT false NOT NULL,
 "is_active" boolean DEFAULT true NOT NULL,
 "created_by_telegram_id" bigint,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."cafe_staff" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "telegram_id" bigint NOT NULL,
 "location_id" uuid NOT NULL,
 "staff_role" text NOT NULL,
 "is_active" boolean DEFAULT true NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "created_by_telegram_id" bigint,
 "can_accept_payments" boolean DEFAULT true NOT NULL
);
CREATE TABLE umma_qa_20261013."cafe_order_items" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "order_id" uuid NOT NULL,
 "product_id" uuid,
 "product_name_ru" text NOT NULL,
 "product_name_vi" text,
 "product_name_en" text,
 "quantity" integer NOT NULL,
 "unit_price_vnd" integer NOT NULL,
 "line_total_vnd" integer GENERATED ALWAYS AS ((quantity * unit_price_vnd)) STORED,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "accounting_stock_item_id" uuid
);
CREATE TABLE umma_qa_20261013."cafe_order_events" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "order_id" uuid NOT NULL,
 "actor_telegram_id" bigint,
 "from_status" text,
 "to_status" text NOT NULL,
 "note" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."cafe_orders" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "order_number" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
 "customer_telegram_id" bigint,
 "location_id" uuid,
 "status" text DEFAULT 'pending'::text NOT NULL,
 "order_type" text NOT NULL,
 "payment_method" text DEFAULT 'cash'::text NOT NULL,
 "payment_status" text DEFAULT 'pending'::text NOT NULL,
 "customer_name" text,
 "customer_phone" text,
 "delivery_address" text,
 "customer_note" text,
 "subtotal_vnd" integer DEFAULT 0 NOT NULL,
 "delivery_fee_vnd" integer DEFAULT 0 NOT NULL,
 "discount_vnd" integer DEFAULT 0 NOT NULL,
 "total_vnd" integer DEFAULT 0 NOT NULL,
 "currency" text DEFAULT 'VND'::text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "confirmed_at" timestamp with time zone,
 "completed_at" timestamp with time zone,
 "cancelled_at" timestamp with time zone,
 "created_by_telegram_id" bigint,
 "created_via" text DEFAULT 'customer'::text NOT NULL,
 "paid_at" timestamp with time zone,
 "paid_by_telegram_id" bigint,
 "delivery_status" text DEFAULT 'not_applicable'::text NOT NULL,
 "courier_telegram_id" bigint,
 "accepted_by_telegram_id" bigint,
 "accepted_at" timestamp with time zone
);
CREATE TABLE umma_qa_20261013."cafe_inventory_movements" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "product_id" uuid NOT NULL,
 "order_id" uuid,
 "actor_telegram_id" bigint,
 "movement_type" text NOT NULL,
 "quantity" numeric NOT NULL,
 "note" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."cafe_staff_shifts" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "staff_telegram_id" bigint NOT NULL,
 "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
 "opened_by_telegram_id" bigint NOT NULL,
 "opening_cash_vnd" integer DEFAULT 0 NOT NULL,
 "closed_at" timestamp with time zone,
 "closed_by_telegram_id" bigint,
 "expected_cash_vnd" integer,
 "counted_cash_vnd" integer,
 "variance_vnd" integer,
 "shift_status" text DEFAULT 'open'::text NOT NULL,
 "close_note" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."cafe_test_orders" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "order_number" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
 "created_by_telegram_id" bigint NOT NULL,
 "simulated_role" text NOT NULL,
 "customer_name" text DEFAULT 'Тестовый гость'::text NOT NULL,
 "order_type" text DEFAULT 'dine_in'::text NOT NULL,
 "payment_method" text DEFAULT 'cash'::text NOT NULL,
 "payment_status" text DEFAULT 'pending'::text NOT NULL,
 "delivery_status" text DEFAULT 'not_required'::text NOT NULL,
 "status" text DEFAULT 'new'::text NOT NULL,
 "total_vnd" integer DEFAULT 0 NOT NULL,
 "note" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "items" jsonb DEFAULT '[]'::jsonb NOT NULL
);
CREATE TABLE umma_qa_20261013."cafe_test_events" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "order_id" uuid,
 "location_id" uuid NOT NULL,
 "actor_telegram_id" bigint NOT NULL,
 "simulated_role" text NOT NULL,
 "event_type" text NOT NULL,
 "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."cafe_test_shifts" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "actor_telegram_id" bigint NOT NULL,
 "simulated_role" text NOT NULL,
 "opening_cash_vnd" integer DEFAULT 0 NOT NULL,
 "counted_cash_vnd" integer,
 "shift_status" text DEFAULT 'open'::text NOT NULL,
 "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
 "closed_at" timestamp with time zone
);
CREATE TABLE umma_qa_20261013."stock_items" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "sku" text,
 "name_ru" text NOT NULL,
 "name_vi" text,
 "name_en" text,
 "item_type" text NOT NULL,
 "base_unit" text NOT NULL,
 "linked_product_id" uuid,
 "is_halal" boolean,
 "is_active" boolean DEFAULT true NOT NULL,
 "notes" text,
 "created_by_telegram_id" bigint,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."stock_balances" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "stock_item_id" uuid NOT NULL,
 "quantity_on_hand" numeric(14,3) DEFAULT 0 NOT NULL,
 "quantity_reserved" numeric(14,3) DEFAULT 0 NOT NULL,
 "average_unit_cost_vnd" numeric(18,4) DEFAULT 0 NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."purchase_documents" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "supplier_id" uuid,
 "document_number" text,
 "purchase_date" date DEFAULT CURRENT_DATE NOT NULL,
 "status" text DEFAULT 'draft'::text NOT NULL,
 "payment_status" text DEFAULT 'unpaid'::text NOT NULL,
 "subtotal_vnd" bigint DEFAULT 0 NOT NULL,
 "notes" text,
 "created_by_telegram_id" bigint NOT NULL,
 "posted_by_telegram_id" bigint,
 "posted_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "paid_amount_vnd" bigint DEFAULT 0 NOT NULL
);
CREATE TABLE umma_qa_20261013."purchase_items" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "purchase_document_id" uuid NOT NULL,
 "stock_item_id" uuid NOT NULL,
 "quantity" numeric(14,3) NOT NULL,
 "unit_cost_vnd" numeric(18,4) NOT NULL,
 "line_total_vnd" bigint NOT NULL,
 "notes" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."operating_expenses" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "expense_date" date DEFAULT CURRENT_DATE NOT NULL,
 "category" text NOT NULL,
 "description" text NOT NULL,
 "amount_vnd" bigint NOT NULL,
 "payment_status" text DEFAULT 'paid'::text NOT NULL,
 "payment_method" text,
 "supplier_id" uuid,
 "receipt_reference" text,
 "notes" text,
 "created_by_telegram_id" bigint NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "paid_amount_vnd" bigint DEFAULT 0 NOT NULL
);
CREATE TABLE umma_qa_20261013."recipes" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "product_id" uuid NOT NULL,
 "version" integer DEFAULT 1 NOT NULL,
 "yield_quantity" numeric(14,3) DEFAULT 1 NOT NULL,
 "yield_unit" text DEFAULT 'portion'::text NOT NULL,
 "is_active" boolean DEFAULT true NOT NULL,
 "notes" text,
 "created_by_telegram_id" bigint,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."recipe_items" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "recipe_id" uuid NOT NULL,
 "stock_item_id" uuid NOT NULL,
 "quantity" numeric(14,3) NOT NULL,
 "notes" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."production_batches" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "recipe_id" uuid,
 "batch_number" text,
 "production_date" date DEFAULT CURRENT_DATE NOT NULL,
 "status" text DEFAULT 'draft'::text NOT NULL,
 "planned_quantity" numeric(14,3) NOT NULL,
 "actual_quantity" numeric(14,3),
 "waste_quantity" numeric(14,3) DEFAULT 0 NOT NULL,
 "total_cost_vnd" bigint DEFAULT 0 NOT NULL,
 "notes" text,
 "created_by_telegram_id" bigint NOT NULL,
 "posted_by_telegram_id" bigint,
 "posted_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."production_batch_items" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "production_batch_id" uuid NOT NULL,
 "stock_item_id" uuid NOT NULL,
 "movement_direction" text NOT NULL,
 "quantity" numeric(14,3) NOT NULL,
 "unit_cost_vnd" numeric(18,4) DEFAULT 0 NOT NULL,
 "line_cost_vnd" bigint DEFAULT 0 NOT NULL,
 "notes" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE umma_qa_20261013."cafe_financial_entries" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "location_id" uuid NOT NULL,
 "transaction_type" text NOT NULL,
 "category" text NOT NULL,
 "amount_vnd" bigint NOT NULL,
 "payment_method" text NOT NULL,
 "source_type" text NOT NULL,
 "source_id" uuid,
 "transaction_at" timestamp with time zone DEFAULT now() NOT NULL,
 "actor_telegram_id" bigint,
 "idempotency_key" text,
 "notes" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE profiles ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (telegram_id);
ALTER TABLE user_settings ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY (telegram_id);
ALTER TABLE user_profiles ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY (telegram_id);
ALTER TABLE locations ADD CONSTRAINT "locations_pkey" PRIMARY KEY (id);
ALTER TABLE categories ADD CONSTRAINT "categories_pkey" PRIMARY KEY (id);
ALTER TABLE products ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);
ALTER TABLE inventory ADD CONSTRAINT "inventory_pkey" PRIMARY KEY (id);
ALTER TABLE inventory ADD CONSTRAINT "inventory_product_id_location_id_key" UNIQUE (product_id, location_id);
ALTER TABLE translation_messages ADD CONSTRAINT "translation_messages_pkey" PRIMARY KEY (id);
ALTER TABLE translation_cache ADD CONSTRAINT "translation_cache_pkey" PRIMARY KEY (id);
ALTER TABLE translation_cache ADD CONSTRAINT "translation_cache_source_language_target_language_source_te_key" UNIQUE (source_language, target_language, source_text);
ALTER TABLE voice_sessions ADD CONSTRAINT "voice_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE voice_turns ADD CONSTRAINT "voice_turns_pkey" PRIMARY KEY (id);
ALTER TABLE translation_settings ADD CONSTRAINT "translation_settings_pkey" PRIMARY KEY (telegram_id);
ALTER TABLE telegram_users ADD CONSTRAINT "telegram_users_pkey" PRIMARY KEY (id);
ALTER TABLE telegram_users ADD CONSTRAINT "telegram_users_telegram_id_key" UNIQUE (telegram_id);
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_order_number_key" UNIQUE (order_number);
ALTER TABLE cafe_order_items ADD CONSTRAINT "cafe_order_items_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_order_events ADD CONSTRAINT "cafe_order_events_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_staff ADD CONSTRAINT "cafe_staff_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_staff ADD CONSTRAINT "cafe_staff_telegram_id_location_id_key" UNIQUE (telegram_id, location_id);
ALTER TABLE cafe_payment_receipts ADD CONSTRAINT "cafe_payment_receipts_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_cash_handovers ADD CONSTRAINT "cafe_cash_handovers_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_staff_shifts ADD CONSTRAINT "cafe_staff_shifts_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_test_orders ADD CONSTRAINT "cafe_test_orders_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_test_events ADD CONSTRAINT "cafe_test_events_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_test_shifts ADD CONSTRAINT "cafe_test_shifts_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_inventory_movements ADD CONSTRAINT "cafe_inventory_movements_pkey" PRIMARY KEY (id);
ALTER TABLE suppliers ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY (id);
ALTER TABLE stock_items ADD CONSTRAINT "stock_items_pkey" PRIMARY KEY (id);
ALTER TABLE stock_items ADD CONSTRAINT "stock_items_sku_unique" UNIQUE (sku);
ALTER TABLE stock_items ADD CONSTRAINT "stock_items_linked_product_unique" UNIQUE (linked_product_id);
ALTER TABLE stock_balances ADD CONSTRAINT "stock_balances_pkey" PRIMARY KEY (id);
ALTER TABLE stock_balances ADD CONSTRAINT "stock_balances_location_id_stock_item_id_key" UNIQUE (location_id, stock_item_id);
ALTER TABLE purchase_documents ADD CONSTRAINT "purchase_documents_pkey" PRIMARY KEY (id);
ALTER TABLE purchase_items ADD CONSTRAINT "purchase_items_pkey" PRIMARY KEY (id);
ALTER TABLE recipes ADD CONSTRAINT "recipes_pkey" PRIMARY KEY (id);
ALTER TABLE recipes ADD CONSTRAINT "recipes_product_id_version_key" UNIQUE (product_id, version);
ALTER TABLE recipe_items ADD CONSTRAINT "recipe_items_pkey" PRIMARY KEY (id);
ALTER TABLE recipe_items ADD CONSTRAINT "recipe_items_recipe_id_stock_item_id_key" UNIQUE (recipe_id, stock_item_id);
ALTER TABLE production_batches ADD CONSTRAINT "production_batches_pkey" PRIMARY KEY (id);
ALTER TABLE production_batch_items ADD CONSTRAINT "production_batch_items_pkey" PRIMARY KEY (id);
ALTER TABLE operating_expenses ADD CONSTRAINT "operating_expenses_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_financial_entries ADD CONSTRAINT "cafe_financial_entries_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_financial_entries ADD CONSTRAINT "cafe_financial_entries_idempotency_key_key" UNIQUE (idempotency_key);
ALTER TABLE stock_movements ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY (id);
ALTER TABLE umma_runtime_settings ADD CONSTRAINT "umma_runtime_settings_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_transfer_proofs ADD CONSTRAINT "cafe_transfer_proofs_pkey" PRIMARY KEY (id);
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_customer_telegram_id_fkey" FOREIGN KEY (customer_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE RESTRICT;
ALTER TABLE user_settings ADD CONSTRAINT "user_settings_telegram_id_fkey" FOREIGN KEY (telegram_id) REFERENCES profiles(telegram_id) ON DELETE CASCADE;
ALTER TABLE user_profiles ADD CONSTRAINT "user_profiles_telegram_id_fkey" FOREIGN KEY (telegram_id) REFERENCES profiles(telegram_id) ON DELETE CASCADE;
ALTER TABLE locations ADD CONSTRAINT "locations_location_type_check" CHECK ((location_type = ANY (ARRAY['cafe'::text, 'warehouse'::text, 'market'::text, 'restaurant'::text, 'other'::text])));
ALTER TABLE categories ADD CONSTRAINT "categories_category_type_check" CHECK ((category_type = ANY (ARRAY['cafe'::text, 'market'::text])));
ALTER TABLE products ADD CONSTRAINT "products_product_type_check" CHECK ((product_type = ANY (ARRAY['cafe'::text, 'market'::text])));
ALTER TABLE products ADD CONSTRAINT "products_price_vnd_check" CHECK ((price_vnd >= 0));
ALTER TABLE products ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE inventory ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE inventory ADD CONSTRAINT "inventory_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE translation_messages ADD CONSTRAINT "translation_messages_translation_type_check" CHECK ((translation_type = ANY (ARRAY['text'::text, 'order'::text, 'voice'::text, 'dialogue'::text])));
ALTER TABLE voice_sessions ADD CONSTRAINT "voice_sessions_mode_check" CHECK ((mode = ANY (ARRAY['order'::text, 'dialogue'::text, 'translation'::text])));
ALTER TABLE voice_sessions ADD CONSTRAINT "voice_sessions_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE voice_turns ADD CONSTRAINT "voice_turns_session_id_fkey" FOREIGN KEY (session_id) REFERENCES voice_sessions(id) ON DELETE CASCADE;
ALTER TABLE telegram_users ADD CONSTRAINT "telegram_users_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'entrepreneur'::text, 'employee'::text, 'admin'::text, 'super_admin'::text])));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE cafe_order_items ADD CONSTRAINT "cafe_order_items_quantity_check" CHECK (((quantity >= 1) AND (quantity <= 99)));
ALTER TABLE cafe_cash_handovers ADD CONSTRAINT "cafe_cash_handovers_to_telegram_id_fkey" FOREIGN KEY (to_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE RESTRICT;
ALTER TABLE cafe_cash_handovers ADD CONSTRAINT "cafe_cash_handovers_accepted_by_telegram_id_fkey" FOREIGN KEY (accepted_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE RESTRICT;
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_order_type_check" CHECK ((order_type = ANY (ARRAY['pickup'::text, 'delivery'::text, 'dine_in'::text])));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_payment_method_check" CHECK ((payment_method = ANY (ARRAY['cash'::text, 'qr'::text, 'bank_transfer'::text, 'card'::text])));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_payment_status_check" CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_subtotal_vnd_check" CHECK ((subtotal_vnd >= 0));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_delivery_fee_vnd_check" CHECK ((delivery_fee_vnd >= 0));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_discount_vnd_check" CHECK ((discount_vnd >= 0));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_total_vnd_check" CHECK ((total_vnd >= 0));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_currency_check" CHECK ((currency = 'VND'::text));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_delivery_address_check" CHECK (((order_type <> 'delivery'::text) OR (NULLIF(TRIM(BOTH FROM delivery_address), ''::text) IS NOT NULL)));
ALTER TABLE cafe_order_items ADD CONSTRAINT "cafe_order_items_unit_price_vnd_check" CHECK ((unit_price_vnd >= 0));
ALTER TABLE cafe_order_items ADD CONSTRAINT "cafe_order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES cafe_orders(id) ON DELETE CASCADE;
ALTER TABLE cafe_order_items ADD CONSTRAINT "cafe_order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE cafe_order_events ADD CONSTRAINT "cafe_order_events_order_id_fkey" FOREIGN KEY (order_id) REFERENCES cafe_orders(id) ON DELETE CASCADE;
ALTER TABLE cafe_order_events ADD CONSTRAINT "cafe_order_events_actor_telegram_id_fkey" FOREIGN KEY (actor_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE SET NULL;
ALTER TABLE cafe_staff ADD CONSTRAINT "cafe_staff_telegram_id_fkey" FOREIGN KEY (telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE CASCADE;
ALTER TABLE cafe_staff ADD CONSTRAINT "cafe_staff_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE cafe_staff ADD CONSTRAINT "cafe_staff_created_by_telegram_id_fkey" FOREIGN KEY (created_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE SET NULL;
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_created_via_check" CHECK ((created_via = ANY (ARRAY['customer'::text, 'staff'::text]))) NOT VALID;
ALTER TABLE cafe_cash_handovers ADD CONSTRAINT "cafe_cash_handovers_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
ALTER TABLE cafe_cash_handovers ADD CONSTRAINT "cafe_cash_handovers_from_telegram_id_fkey" FOREIGN KEY (from_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE RESTRICT;
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_delivery_status_check" CHECK ((delivery_status = ANY (ARRAY['not_applicable'::text, 'waiting_courier'::text, 'courier_assigned'::text, 'picked_up'::text, 'delivered'::text]))) NOT VALID;
ALTER TABLE cafe_payment_receipts ADD CONSTRAINT "cafe_payment_receipts_payment_method_check" CHECK ((payment_method = ANY (ARRAY['cash'::text, 'qr'::text, 'bank_transfer'::text, 'card'::text])));
ALTER TABLE cafe_payment_receipts ADD CONSTRAINT "cafe_payment_receipts_amount_vnd_check" CHECK ((amount_vnd > 0));
ALTER TABLE cafe_payment_receipts ADD CONSTRAINT "cafe_payment_receipts_receipt_status_check" CHECK ((receipt_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'voided'::text, 'refunded'::text])));
ALTER TABLE cafe_payment_receipts ADD CONSTRAINT "cafe_payment_receipts_order_id_fkey" FOREIGN KEY (order_id) REFERENCES cafe_orders(id) ON DELETE RESTRICT;
ALTER TABLE cafe_payment_receipts ADD CONSTRAINT "cafe_payment_receipts_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
ALTER TABLE cafe_payment_receipts ADD CONSTRAINT "cafe_payment_receipts_collected_by_telegram_id_fkey" FOREIGN KEY (collected_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE RESTRICT;
ALTER TABLE cafe_cash_handovers ADD CONSTRAINT "cafe_cash_handovers_amount_vnd_check" CHECK ((amount_vnd > 0));
ALTER TABLE cafe_cash_handovers ADD CONSTRAINT "cafe_cash_handovers_handover_status_check" CHECK ((handover_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text])));
ALTER TABLE cafe_cash_handovers ADD CONSTRAINT "cafe_cash_handovers_check" CHECK ((from_telegram_id <> to_telegram_id));
ALTER TABLE cafe_staff ADD CONSTRAINT "cafe_staff_staff_role_check" CHECK ((staff_role = ANY (ARRAY['manager'::text, 'cashier'::text, 'waiter'::text, 'kitchen'::text, 'courier'::text])));
ALTER TABLE cafe_staff_shifts ADD CONSTRAINT "cafe_staff_shifts_opening_cash_vnd_check" CHECK ((opening_cash_vnd >= 0));
ALTER TABLE cafe_staff_shifts ADD CONSTRAINT "cafe_staff_shifts_shift_status_check" CHECK ((shift_status = ANY (ARRAY['open'::text, 'closed'::text, 'voided'::text])));
ALTER TABLE cafe_staff_shifts ADD CONSTRAINT "cafe_staff_shifts_close_values" CHECK ((((shift_status = 'open'::text) AND (closed_at IS NULL) AND (counted_cash_vnd IS NULL) AND (variance_vnd IS NULL)) OR ((shift_status = ANY (ARRAY['closed'::text, 'voided'::text])) AND (closed_at IS NOT NULL))));
ALTER TABLE cafe_staff_shifts ADD CONSTRAINT "cafe_staff_shifts_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id);
ALTER TABLE cafe_test_orders ADD CONSTRAINT "cafe_test_orders_simulated_role_check" CHECK ((simulated_role = ANY (ARRAY['waiter'::text, 'cashier'::text, 'kitchen'::text, 'manager'::text, 'courier'::text])));
ALTER TABLE cafe_test_orders ADD CONSTRAINT "cafe_test_orders_order_type_check" CHECK ((order_type = ANY (ARRAY['dine_in'::text, 'pickup'::text, 'delivery'::text])));
ALTER TABLE cafe_test_orders ADD CONSTRAINT "cafe_test_orders_payment_method_check" CHECK ((payment_method = ANY (ARRAY['cash'::text, 'qr'::text])));
ALTER TABLE stock_items ADD CONSTRAINT "stock_items_created_by_telegram_id_fkey" FOREIGN KEY (created_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE SET NULL;
ALTER TABLE cafe_test_orders ADD CONSTRAINT "cafe_test_orders_payment_status_check" CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text])));
ALTER TABLE cafe_test_orders ADD CONSTRAINT "cafe_test_orders_delivery_status_check" CHECK ((delivery_status = ANY (ARRAY['not_required'::text, 'waiting_courier'::text, 'courier_assigned'::text, 'picked_up'::text, 'delivered'::text])));
ALTER TABLE cafe_test_orders ADD CONSTRAINT "cafe_test_orders_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE cafe_test_orders ADD CONSTRAINT "cafe_test_orders_total_vnd_check" CHECK ((total_vnd >= 0));
ALTER TABLE cafe_test_orders ADD CONSTRAINT "cafe_test_orders_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id);
ALTER TABLE cafe_test_events ADD CONSTRAINT "cafe_test_events_simulated_role_check" CHECK ((simulated_role = ANY (ARRAY['waiter'::text, 'cashier'::text, 'kitchen'::text, 'manager'::text, 'courier'::text])));
ALTER TABLE cafe_test_events ADD CONSTRAINT "cafe_test_events_order_id_fkey" FOREIGN KEY (order_id) REFERENCES cafe_test_orders(id) ON DELETE CASCADE;
ALTER TABLE cafe_test_events ADD CONSTRAINT "cafe_test_events_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id);
ALTER TABLE inventory ADD CONSTRAINT "inventory_price_vnd_check" CHECK (((price_vnd IS NULL) OR (price_vnd >= 0)));
ALTER TABLE cafe_orders ADD CONSTRAINT "cafe_orders_accepted_by_telegram_id_fkey" FOREIGN KEY (accepted_by_telegram_id) REFERENCES telegram_users(telegram_id);
ALTER TABLE cafe_test_shifts ADD CONSTRAINT "cafe_test_shifts_simulated_role_check" CHECK ((simulated_role = ANY (ARRAY['waiter'::text, 'cashier'::text, 'kitchen'::text, 'manager'::text, 'courier'::text])));
ALTER TABLE cafe_test_shifts ADD CONSTRAINT "cafe_test_shifts_opening_cash_vnd_check" CHECK ((opening_cash_vnd >= 0));
ALTER TABLE cafe_test_shifts ADD CONSTRAINT "cafe_test_shifts_shift_status_check" CHECK ((shift_status = ANY (ARRAY['open'::text, 'closed'::text])));
ALTER TABLE cafe_test_shifts ADD CONSTRAINT "cafe_test_shifts_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id);
ALTER TABLE cafe_order_events ADD CONSTRAINT "cafe_order_events_to_status_check" CHECK ((to_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'completed'::text, 'cancelled'::text, 'waiting_courier'::text, 'courier_assigned'::text, 'picked_up'::text, 'delivered'::text])));
ALTER TABLE stock_items ADD CONSTRAINT "stock_items_linked_product_id_fkey" FOREIGN KEY (linked_product_id) REFERENCES products(id) ON DELETE RESTRICT;
ALTER TABLE cafe_inventory_movements ADD CONSTRAINT "cafe_inventory_movements_movement_type_check" CHECK ((movement_type = ANY (ARRAY['stock_set'::text, 'reserved'::text, 'released'::text, 'sold'::text, 'adjustment'::text])));
ALTER TABLE cafe_inventory_movements ADD CONSTRAINT "cafe_inventory_movements_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id);
ALTER TABLE cafe_inventory_movements ADD CONSTRAINT "cafe_inventory_movements_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE cafe_inventory_movements ADD CONSTRAINT "cafe_inventory_movements_order_id_fkey" FOREIGN KEY (order_id) REFERENCES cafe_orders(id);
ALTER TABLE cafe_inventory_movements ADD CONSTRAINT "cafe_inventory_movements_actor_telegram_id_fkey" FOREIGN KEY (actor_telegram_id) REFERENCES telegram_users(telegram_id);
ALTER TABLE suppliers ADD CONSTRAINT "suppliers_name_check" CHECK ((length(TRIM(BOTH FROM name)) > 0));
ALTER TABLE suppliers ADD CONSTRAINT "suppliers_created_by_telegram_id_fkey" FOREIGN KEY (created_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE SET NULL;
ALTER TABLE stock_items ADD CONSTRAINT "stock_items_name_ru_check" CHECK ((length(TRIM(BOTH FROM name_ru)) > 0));
ALTER TABLE stock_items ADD CONSTRAINT "stock_items_item_type_check" CHECK ((item_type = ANY (ARRAY['raw_material'::text, 'finished_good'::text, 'packaging'::text, 'other'::text])));
ALTER TABLE stock_items ADD CONSTRAINT "stock_items_base_unit_check" CHECK ((base_unit = ANY (ARRAY['kg'::text, 'g'::text, 'l'::text, 'ml'::text, 'pcs'::text, 'portion'::text])));
ALTER TABLE stock_balances ADD CONSTRAINT "stock_balances_quantity_on_hand_check" CHECK ((quantity_on_hand >= (0)::numeric));
ALTER TABLE stock_balances ADD CONSTRAINT "stock_balances_quantity_reserved_check" CHECK ((quantity_reserved >= (0)::numeric));
ALTER TABLE stock_balances ADD CONSTRAINT "stock_balances_average_unit_cost_vnd_check" CHECK ((average_unit_cost_vnd >= (0)::numeric));
ALTER TABLE stock_balances ADD CONSTRAINT "stock_balances_check" CHECK ((quantity_reserved <= quantity_on_hand));
ALTER TABLE stock_balances ADD CONSTRAINT "stock_balances_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
ALTER TABLE stock_balances ADD CONSTRAINT "stock_balances_stock_item_id_fkey" FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE RESTRICT;
ALTER TABLE purchase_documents ADD CONSTRAINT "purchase_documents_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'cancelled'::text])));
ALTER TABLE purchase_documents ADD CONSTRAINT "purchase_documents_payment_status_check" CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'partially_paid'::text, 'paid'::text])));
ALTER TABLE purchase_documents ADD CONSTRAINT "purchase_documents_subtotal_vnd_check" CHECK ((subtotal_vnd >= 0));
ALTER TABLE purchase_documents ADD CONSTRAINT "purchase_documents_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
ALTER TABLE purchase_documents ADD CONSTRAINT "purchase_documents_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT;
ALTER TABLE purchase_documents ADD CONSTRAINT "purchase_documents_created_by_telegram_id_fkey" FOREIGN KEY (created_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE RESTRICT;
ALTER TABLE purchase_documents ADD CONSTRAINT "purchase_documents_posted_by_telegram_id_fkey" FOREIGN KEY (posted_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE RESTRICT;
ALTER TABLE stock_movements ADD CONSTRAINT "stock_movements_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
ALTER TABLE stock_movements ADD CONSTRAINT "stock_movements_stock_item_id_fkey" FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE RESTRICT;
ALTER TABLE purchase_items ADD CONSTRAINT "purchase_items_quantity_check" CHECK ((quantity > (0)::numeric));
ALTER TABLE purchase_items ADD CONSTRAINT "purchase_items_unit_cost_vnd_check" CHECK ((unit_cost_vnd >= (0)::numeric));
ALTER TABLE purchase_items ADD CONSTRAINT "purchase_items_line_total_vnd_check" CHECK ((line_total_vnd >= 0));
ALTER TABLE purchase_items ADD CONSTRAINT "purchase_items_purchase_document_id_fkey" FOREIGN KEY (purchase_document_id) REFERENCES purchase_documents(id) ON DELETE CASCADE;
ALTER TABLE purchase_items ADD CONSTRAINT "purchase_items_stock_item_id_fkey" FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE RESTRICT;
ALTER TABLE recipes ADD CONSTRAINT "recipes_version_check" CHECK ((version > 0));
ALTER TABLE recipes ADD CONSTRAINT "recipes_yield_quantity_check" CHECK ((yield_quantity > (0)::numeric));
ALTER TABLE recipes ADD CONSTRAINT "recipes_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
ALTER TABLE recipes ADD CONSTRAINT "recipes_created_by_telegram_id_fkey" FOREIGN KEY (created_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE SET NULL;
ALTER TABLE recipe_items ADD CONSTRAINT "recipe_items_quantity_check" CHECK ((quantity > (0)::numeric));
ALTER TABLE recipe_items ADD CONSTRAINT "recipe_items_recipe_id_fkey" FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE;
ALTER TABLE recipe_items ADD CONSTRAINT "recipe_items_stock_item_id_fkey" FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE RESTRICT;
ALTER TABLE production_batches ADD CONSTRAINT "production_batches_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'cancelled'::text])));
ALTER TABLE stock_movements ADD CONSTRAINT "stock_movements_actor_telegram_id_fkey" FOREIGN KEY (actor_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE SET NULL;
ALTER TABLE production_batches ADD CONSTRAINT "production_batches_planned_quantity_check" CHECK ((planned_quantity > (0)::numeric));
ALTER TABLE production_batches ADD CONSTRAINT "production_batches_actual_quantity_check" CHECK (((actual_quantity IS NULL) OR (actual_quantity > (0)::numeric)));
ALTER TABLE production_batches ADD CONSTRAINT "production_batches_waste_quantity_check" CHECK ((waste_quantity >= (0)::numeric));
ALTER TABLE production_batches ADD CONSTRAINT "production_batches_total_cost_vnd_check" CHECK ((total_cost_vnd >= 0));
ALTER TABLE production_batches ADD CONSTRAINT "production_batches_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
ALTER TABLE production_batches ADD CONSTRAINT "production_batches_recipe_id_fkey" FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE RESTRICT;
ALTER TABLE production_batches ADD CONSTRAINT "production_batches_created_by_telegram_id_fkey" FOREIGN KEY (created_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE RESTRICT;
ALTER TABLE production_batches ADD CONSTRAINT "production_batches_posted_by_telegram_id_fkey" FOREIGN KEY (posted_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE RESTRICT;
ALTER TABLE production_batch_items ADD CONSTRAINT "production_batch_items_movement_direction_check" CHECK ((movement_direction = ANY (ARRAY['input'::text, 'output'::text, 'waste'::text])));
ALTER TABLE production_batch_items ADD CONSTRAINT "production_batch_items_quantity_check" CHECK ((quantity > (0)::numeric));
ALTER TABLE production_batch_items ADD CONSTRAINT "production_batch_items_unit_cost_vnd_check" CHECK ((unit_cost_vnd >= (0)::numeric));
ALTER TABLE production_batch_items ADD CONSTRAINT "production_batch_items_line_cost_vnd_check" CHECK ((line_cost_vnd >= 0));
ALTER TABLE production_batch_items ADD CONSTRAINT "production_batch_items_production_batch_id_fkey" FOREIGN KEY (production_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE;
ALTER TABLE production_batch_items ADD CONSTRAINT "production_batch_items_stock_item_id_fkey" FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE RESTRICT;
ALTER TABLE operating_expenses ADD CONSTRAINT "operating_expenses_category_check" CHECK ((category = ANY (ARRAY['rent'::text, 'utilities'::text, 'payroll'::text, 'delivery'::text, 'maintenance'::text, 'marketing'::text, 'supplies'::text, 'taxes'::text, 'bank_fees'::text, 'other'::text])));
ALTER TABLE operating_expenses ADD CONSTRAINT "operating_expenses_description_check" CHECK ((length(TRIM(BOTH FROM description)) > 0));
ALTER TABLE operating_expenses ADD CONSTRAINT "operating_expenses_amount_vnd_check" CHECK ((amount_vnd > 0));
ALTER TABLE operating_expenses ADD CONSTRAINT "operating_expenses_payment_status_check" CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'partially_paid'::text])));
ALTER TABLE operating_expenses ADD CONSTRAINT "operating_expenses_payment_method_check" CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['cash'::text, 'qr'::text, 'bank_transfer'::text, 'card'::text, 'other'::text]))));
ALTER TABLE operating_expenses ADD CONSTRAINT "operating_expenses_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
ALTER TABLE operating_expenses ADD CONSTRAINT "operating_expenses_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT;
ALTER TABLE operating_expenses ADD CONSTRAINT "operating_expenses_created_by_telegram_id_fkey" FOREIGN KEY (created_by_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE RESTRICT;
ALTER TABLE cafe_financial_entries ADD CONSTRAINT "cafe_financial_entries_transaction_type_check" CHECK ((transaction_type = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text])));
ALTER TABLE cafe_financial_entries ADD CONSTRAINT "cafe_financial_entries_amount_vnd_check" CHECK ((amount_vnd > 0));
ALTER TABLE cafe_financial_entries ADD CONSTRAINT "cafe_financial_entries_payment_method_check" CHECK ((payment_method = ANY (ARRAY['cash'::text, 'qr'::text, 'bank_transfer'::text, 'card'::text, 'other'::text])));
ALTER TABLE cafe_financial_entries ADD CONSTRAINT "cafe_financial_entries_source_type_check" CHECK ((source_type = ANY (ARRAY['order_payment'::text, 'purchase_payment'::text, 'operating_expense'::text, 'refund'::text, 'cash_handover'::text, 'manual_adjustment'::text])));
ALTER TABLE cafe_financial_entries ADD CONSTRAINT "cafe_financial_entries_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;
ALTER TABLE cafe_financial_entries ADD CONSTRAINT "cafe_financial_entries_actor_telegram_id_fkey" FOREIGN KEY (actor_telegram_id) REFERENCES telegram_users(telegram_id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD CONSTRAINT "stock_movements_movement_type_check" CHECK ((movement_type = ANY (ARRAY['purchase_in'::text, 'production_in'::text, 'production_out'::text, 'sale_out'::text, 'waste_out'::text, 'adjustment_in'::text, 'adjustment_out'::text, 'transfer_in'::text, 'transfer_out'::text, 'reservation'::text, 'release'::text])));
ALTER TABLE stock_movements ADD CONSTRAINT "stock_movements_quantity_delta_check" CHECK ((quantity_delta <> (0)::numeric));
ALTER TABLE stock_movements ADD CONSTRAINT "stock_movements_unit_cost_vnd_check" CHECK ((unit_cost_vnd >= (0)::numeric));
ALTER TABLE stock_movements ADD CONSTRAINT "stock_movements_source_type_check" CHECK (((source_type IS NULL) OR (source_type = ANY (ARRAY['purchase_document'::text, 'production_batch'::text, 'order'::text, 'manual_adjustment'::text, 'transfer'::text]))));
ALTER TABLE purchase_documents ADD CONSTRAINT "purchase_documents_paid_amount_check" CHECK (((paid_amount_vnd >= 0) AND ((status <> 'posted'::text) OR (paid_amount_vnd <= subtotal_vnd))));
ALTER TABLE operating_expenses ADD CONSTRAINT "operating_expenses_paid_amount_check" CHECK (((paid_amount_vnd >= 0) AND (paid_amount_vnd <= amount_vnd)));
ALTER TABLE cafe_order_items ADD CONSTRAINT "cafe_order_items_accounting_stock_item_id_fkey" FOREIGN KEY (accounting_stock_item_id) REFERENCES stock_items(id) ON DELETE RESTRICT;
ALTER TABLE umma_runtime_settings ADD CONSTRAINT "umma_runtime_settings_id_check" CHECK ((id = true));
ALTER TABLE umma_runtime_settings ADD CONSTRAINT "umma_runtime_settings_data_stage_check" CHECK ((data_stage = ANY (ARRAY['temporary_test'::text, 'live'::text])));
ALTER TABLE cafe_transfer_proofs ADD CONSTRAINT "cafe_transfer_proofs_bank_country_check" CHECK ((bank_country = ANY (ARRAY['RU'::text, 'KZ'::text])));
ALTER TABLE cafe_transfer_proofs ADD CONSTRAINT "cafe_transfer_proofs_review_status_check" CHECK ((review_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])));
ALTER TABLE cafe_transfer_proofs ADD CONSTRAINT "cafe_transfer_proofs_order_id_fkey" FOREIGN KEY (order_id) REFERENCES cafe_orders(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION umma_qa_20261013.add_cafe_staff_order_items(p_staff_telegram_id bigint, p_order_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_order umma_qa_20261013.cafe_orders%rowtype;
  v_user umma_qa_20261013.telegram_users%rowtype;
  v_staff_role text;
  v_item jsonb;
  v_product umma_qa_20261013.products%rowtype;
  v_quantity integer;
  v_added integer := 0;
begin
  if p_staff_telegram_id is null or p_staff_telegram_id <= 0 then raise exception 'Invalid staff'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception 'Invalid order items'; end if;
  select * into v_user from umma_qa_20261013.telegram_users where telegram_id=p_staff_telegram_id and is_active=true;
  if not found or v_user.role not in ('super_admin','admin','employee') then raise exception 'Staff access denied'; end if;
  select * into v_order from umma_qa_20261013.cafe_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_type <> 'dine_in' then raise exception 'Only dine-in bills can receive additional items'; end if;
  if v_order.payment_status = 'paid' or v_order.status in ('completed','cancelled') then raise exception 'Bill is already closed'; end if;
  if v_user.role <> 'super_admin' then
    select staff_role into v_staff_role from umma_qa_20261013.cafe_staff where telegram_id=p_staff_telegram_id and location_id=v_order.location_id and is_active=true;
    if not found or v_staff_role not in ('manager','waiter','cashier','kitchen') then raise exception 'Staff cannot add items to this bill'; end if;
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item)<>'object' or not(v_item?'productId') or not(v_item?'quantity') then raise exception 'Invalid item'; end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 99 then raise exception 'Invalid item quantity'; end if;
    select * into v_product from umma_qa_20261013.products where id=(v_item->>'productId')::uuid and product_type='cafe' and is_active=true;
    if not found then raise exception 'Product not found or unavailable'; end if;
    insert into umma_qa_20261013.cafe_order_items(order_id,product_id,product_name_ru,product_name_vi,product_name_en,quantity,unit_price_vnd)
    values(v_order.id,v_product.id,v_product.name_ru,v_product.name_vi,v_product.name_en,v_quantity,v_product.price_vnd);
    v_added := v_added + 1;
  end loop;
  update umma_qa_20261013.cafe_orders
    set subtotal_vnd=(select coalesce(sum(line_total_vnd),0) from umma_qa_20261013.cafe_order_items where order_id=v_order.id),
        total_vnd=(select coalesce(sum(line_total_vnd),0) from umma_qa_20261013.cafe_order_items where order_id=v_order.id),
        updated_at=now()
    where id=v_order.id returning * into v_order;
  insert into umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
  values(v_order.id,p_staff_telegram_id,v_order.status,v_order.status,'Добавлено позиций в открытый счёт: '||v_added);
  return jsonb_build_object('ok',true,'orderId',v_order.id,'orderNumber',v_order.order_number,'addedItems',v_added,'totalVnd',v_order.total_vnd,'paymentStatus',v_order.payment_status);
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.admin_upsert_location(p_actor_telegram_id bigint, p_location_id uuid, p_name text, p_location_type text, p_address text, p_city text, p_country text, p_latitude numeric, p_longitude numeric, p_phone text, p_is_active boolean, p_manager_telegram_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
 v_actor umma_qa_20261013.telegram_users%rowtype;
 v_manager umma_qa_20261013.telegram_users%rowtype;
 v_location umma_qa_20261013.locations%rowtype;
 v_manager_id bigint;
begin
 select * into v_actor from umma_qa_20261013.telegram_users where telegram_id=p_actor_telegram_id and is_active=true;
 if not found or v_actor.role<>'super_admin' then raise exception 'Only the super administrator can manage locations'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Location name is required'; end if;
 if p_location_type not in ('cafe','restaurant','warehouse','market','other') then raise exception 'Invalid location type'; end if;
 if p_latitude is null or p_longitude is null or p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
   raise exception 'Choose the location on the map';
 end if;
 if p_location_type in ('cafe','restaurant') and (nullif(trim(p_address),'') is null or nullif(trim(p_city),'') is null) then
   raise exception 'Cafe address and city are required';
 end if;
 if p_location_id is null and p_location_type in ('cafe','restaurant') and p_manager_telegram_id is null then
   raise exception 'Assign a cafe administrator before saving';
 end if;
 if p_manager_telegram_id is not null then
   select * into v_manager from umma_qa_20261013.telegram_users where telegram_id=p_manager_telegram_id and is_active=true;
   if not found then raise exception 'The selected administrator has no active Umma account'; end if;
   if v_manager.role='super_admin' then raise exception 'The super administrator cannot be assigned as a cafe administrator'; end if;
 end if;
 if p_location_id is null then
   insert into umma_qa_20261013.locations(name,location_type,address,city,country,latitude,longitude,phone,is_active,updated_at)
   values(trim(p_name),p_location_type,nullif(trim(p_address),''),nullif(trim(p_city),''),coalesce(nullif(trim(p_country),''),'Vietnam'),p_latitude,p_longitude,nullif(trim(p_phone),''),coalesce(p_is_active,true),now())
   returning * into v_location;
 else
   update umma_qa_20261013.locations set name=trim(p_name),location_type=p_location_type,address=nullif(trim(p_address),''),city=nullif(trim(p_city),''),
     country=coalesce(nullif(trim(p_country),''),'Vietnam'),latitude=p_latitude,longitude=p_longitude,phone=nullif(trim(p_phone),''),
     is_active=coalesce(p_is_active,true),updated_at=now()
   where id=p_location_id returning * into v_location;
   if not found then raise exception 'Location not found'; end if;
 end if;
 if p_manager_telegram_id is not null and p_location_type in ('cafe','restaurant') then
   update umma_qa_20261013.cafe_staff set is_active=false,updated_at=now()
   where location_id=v_location.id and staff_role='manager' and is_active=true and telegram_id<>p_manager_telegram_id;
   if v_manager.role in ('user','employee') then
     update umma_qa_20261013.telegram_users set role='admin',updated_at=now() where telegram_id=p_manager_telegram_id;
   end if;
   insert into umma_qa_20261013.cafe_staff(telegram_id,location_id,staff_role,is_active,created_by_telegram_id,updated_at)
   values(p_manager_telegram_id,v_location.id,'manager',true,p_actor_telegram_id,now())
   on conflict (telegram_id,location_id) do update set staff_role='manager',is_active=true,updated_at=now(),created_by_telegram_id=excluded.created_by_telegram_id;
 end if;
 select telegram_id into v_manager_id from umma_qa_20261013.cafe_staff where location_id=v_location.id and staff_role='manager' and is_active=true limit 1;
 return jsonb_build_object('ok',true,'location',jsonb_build_object('id',v_location.id,'name',v_location.name,'locationType',v_location.location_type,
   'address',v_location.address,'city',v_location.city,'country',v_location.country,'latitude',v_location.latitude,'longitude',v_location.longitude,
   'phone',v_location.phone,'isActive',v_location.is_active,'managerTelegramId',v_manager_id));
end; $function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.close_cafe_staff_shift(p_shift_id uuid, p_actor_telegram_id bigint, p_counted_cash_vnd integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013'
AS $function$
declare
  v_shift umma_qa_20261013.cafe_staff_shifts%rowtype;
  v_actor_role text;
  v_staff_role text;
  v_cash_sales integer := 0;
  v_handover_in integer := 0;
  v_handover_out integer := 0;
  v_expected integer;
begin
  if p_counted_cash_vnd is null or p_counted_cash_vnd < 0 then
    raise exception 'Фактическая сумма не может быть отрицательной';
  end if;

  select * into v_shift from umma_qa_20261013.cafe_staff_shifts where id = p_shift_id for update;
  if not found then raise exception 'Смена не найдена'; end if;
  if v_shift.shift_status <> 'open' then raise exception 'Смена уже закрыта'; end if;

  select role into v_actor_role from umma_qa_20261013.telegram_users
  where telegram_id = p_actor_telegram_id and is_active = true;
  if v_actor_role is null then raise exception 'Доступ запрещён'; end if;

  if p_actor_telegram_id <> v_shift.staff_telegram_id and v_actor_role <> 'super_admin' then
    select staff_role into v_staff_role from umma_qa_20261013.cafe_staff
    where location_id = v_shift.location_id and telegram_id = p_actor_telegram_id and is_active = true;
    if v_staff_role not in ('manager','cashier') then raise exception 'Нет права закрыть чужую смену'; end if;
  end if;

  select coalesce(sum(amount_vnd),0)::integer into v_cash_sales
  from umma_qa_20261013.cafe_payment_receipts
  where location_id = v_shift.location_id
    and collected_by_telegram_id = v_shift.staff_telegram_id
    and payment_method = 'cash' and receipt_status = 'confirmed'
    and collected_at >= v_shift.opened_at and collected_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_out
  from umma_qa_20261013.cafe_cash_handovers
  where location_id = v_shift.location_id and from_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_in
  from umma_qa_20261013.cafe_cash_handovers
  where location_id = v_shift.location_id and to_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  v_expected := v_shift.opening_cash_vnd + v_cash_sales + v_handover_in - v_handover_out;

  update umma_qa_20261013.cafe_staff_shifts
  set closed_at = now(), closed_by_telegram_id = p_actor_telegram_id,
      expected_cash_vnd = v_expected, counted_cash_vnd = p_counted_cash_vnd,
      variance_vnd = p_counted_cash_vnd - v_expected,
      shift_status = 'closed', close_note = nullif(left(coalesce(p_note,''),1000),'')
  where id = p_shift_id returning * into v_shift;

  return jsonb_build_object('ok',true,'shift',to_jsonb(v_shift));
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.create_cafe_cash_handover(p_location_id uuid, p_from_telegram_id bigint, p_to_telegram_id bigint, p_amount_vnd integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_user umma_qa_20261013.telegram_users%rowtype;
  v_from_role text;
  v_to_role text;
  v_handover umma_qa_20261013.cafe_cash_handovers%rowtype;
begin
  if p_location_id is null or p_from_telegram_id is null or p_to_telegram_id is null or p_amount_vnd is null or p_amount_vnd<=0 then raise exception 'Invalid cash handover request'; end if;
  if p_from_telegram_id=p_to_telegram_id then raise exception 'Sender and receiver must be different'; end if;
  select * into v_user from umma_qa_20261013.telegram_users where telegram_id=p_from_telegram_id and is_active=true;
  if not found then raise exception 'Cash handover access denied'; end if;
  if v_user.role='super_admin' then v_from_role:='manager';
  else
    if v_user.role not in ('admin','employee') then raise exception 'Cash handover access denied'; end if;
    select staff_role into v_from_role from umma_qa_20261013.cafe_staff where telegram_id=p_from_telegram_id and location_id=p_location_id and is_active=true;
    if not found then raise exception 'Sender has no active assignment for this cafe'; end if;
  end if;
  select staff_role into v_to_role from umma_qa_20261013.cafe_staff where telegram_id=p_to_telegram_id and location_id=p_location_id and is_active=true;
  if not found then
    select role into v_user.role from umma_qa_20261013.telegram_users where telegram_id=p_to_telegram_id and is_active=true;
    if not found or v_user.role<>'super_admin' then raise exception 'Receiver has no active assignment for this cafe'; end if;
    v_to_role:='manager';
  end if;
  if v_from_role not in ('manager','cashier','waiter','kitchen','courier') then raise exception 'Sender role cannot hand over cash'; end if;
  if v_to_role not in ('manager','cashier') then raise exception 'Cash can only be handed to cashier or administrator'; end if;
  if v_to_role='cashier' and v_from_role='cashier' then raise exception 'Cashier cannot hand over cash to themselves'; end if;
  if v_to_role='manager' and v_from_role not in ('cashier','manager') then raise exception 'Staff must hand cash to cashier first'; end if;
  if v_to_role='manager' and v_from_role='manager' then raise exception 'Administrator cannot hand over cash to themselves'; end if;
  insert into umma_qa_20261013.cafe_cash_handovers(location_id,from_telegram_id,to_telegram_id,amount_vnd,handover_status,note)
  values(p_location_id,p_from_telegram_id,p_to_telegram_id,p_amount_vnd,'pending',nullif(trim(p_note),'')) returning * into v_handover;
  return jsonb_build_object('ok',true,'handover',jsonb_build_object('id',v_handover.id,'locationId',v_handover.location_id,'fromTelegramId',v_handover.from_telegram_id,'toTelegramId',v_handover.to_telegram_id,'amountVnd',v_handover.amount_vnd,'status',v_handover.handover_status,'createdAt',v_handover.created_at));
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.create_cafe_order(p_customer_telegram_id bigint, p_items jsonb, p_order_type text, p_location_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_delivery_address text DEFAULT NULL::text, p_payment_method text DEFAULT 'cash'::text, p_customer_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_user umma_qa_20261013.telegram_users%rowtype;
  v_location umma_qa_20261013.locations%rowtype;
  v_order umma_qa_20261013.cafe_orders%rowtype;
  v_item jsonb;
  v_product umma_qa_20261013.products%rowtype;
  v_quantity integer;
  v_subtotal integer := 0;
  v_item_count integer := 0;
begin
  if p_customer_telegram_id is null or p_customer_telegram_id <= 0 then
    raise exception 'Invalid customer';
  end if;

  if p_order_type not in ('pickup','delivery','dine_in') then
    raise exception 'Invalid order type';
  end if;

  if p_payment_method not in ('cash','qr','bank_transfer','card') then
    raise exception 'Invalid payment method';
  end if;

  if p_order_type = 'delivery' and nullif(trim(p_delivery_address), '') is null then
    raise exception 'Delivery address is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid order items';
  end if;

  select * into v_user
  from umma_qa_20261013.telegram_users
  where telegram_id = p_customer_telegram_id and is_active = true;

  if not found then
    raise exception 'Customer is not active or registered';
  end if;

  if p_location_id is not null then
    select * into v_location
    from umma_qa_20261013.locations
    where id = p_location_id and is_active = true
      and location_type in ('cafe','restaurant');

    if not found then
      raise exception 'Cafe location not found or inactive';
    end if;
  end if;

  insert into umma_qa_20261013.cafe_orders (
    customer_telegram_id, location_id, order_type, payment_method,
    customer_name, customer_phone, delivery_address, customer_note
  ) values (
    p_customer_telegram_id, p_location_id, p_order_type, p_payment_method,
    coalesce(nullif(trim(p_customer_name), ''), nullif(trim(concat_ws(' ', v_user.first_name, v_user.last_name)), '')),
    nullif(trim(p_customer_phone), ''),
    nullif(trim(p_delivery_address), ''),
    nullif(trim(p_customer_note), '')
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'productId')
       or not (v_item ? 'quantity') then
      raise exception 'Invalid item';
    end if;

    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'Invalid item quantity';
    end if;

    select * into v_product
    from umma_qa_20261013.products
    where id = (v_item->>'productId')::uuid
      and product_type = 'cafe'
      and is_active = true;

    if not found then
      raise exception 'Product not found or unavailable';
    end if;

    insert into umma_qa_20261013.cafe_order_items (
      order_id, product_id, product_name_ru, product_name_vi, product_name_en,
      quantity, unit_price_vnd
    ) values (
      v_order.id, v_product.id, v_product.name_ru, v_product.name_vi, v_product.name_en,
      v_quantity, v_product.price_vnd
    );

    v_subtotal := v_subtotal + (v_product.price_vnd * v_quantity);
    v_item_count := v_item_count + 1;
  end loop;

  if v_item_count < 1 then
    raise exception 'Order has no items';
  end if;

  update umma_qa_20261013.cafe_orders
  set subtotal_vnd = v_subtotal,
      total_vnd = v_subtotal,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into umma_qa_20261013.cafe_order_events (order_id, actor_telegram_id, from_status, to_status, note)
  values (v_order.id, p_customer_telegram_id, null, 'pending', 'Order created');

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'orderNumber', v_order.order_number,
      'status', v_order.status,
      'orderType', v_order.order_type,
      'subtotalVnd', v_order.subtotal_vnd,
      'totalVnd', v_order.total_vnd,
      'currency', v_order.currency,
      'createdAt', v_order.created_at
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.create_cafe_staff_order(p_staff_telegram_id bigint, p_location_id uuid, p_items jsonb, p_order_type text, p_customer_name text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_delivery_address text DEFAULT NULL::text, p_payment_method text DEFAULT 'cash'::text, p_customer_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_user umma_qa_20261013.telegram_users%rowtype;
  v_location umma_qa_20261013.locations%rowtype;
  v_staff_role text;
  v_order umma_qa_20261013.cafe_orders%rowtype;
  v_item jsonb;
  v_product umma_qa_20261013.products%rowtype;
  v_quantity integer;
  v_subtotal integer:=0;
  v_item_count integer:=0;
begin
  if p_staff_telegram_id is null or p_staff_telegram_id<=0 then raise exception 'Invalid staff'; end if;
  if p_order_type not in ('pickup','delivery','dine_in') then raise exception 'Invalid order type'; end if;
  if p_payment_method not in ('cash','qr','bank_transfer','card') then raise exception 'Invalid payment method'; end if;
  if p_order_type='delivery' and nullif(trim(p_delivery_address),'') is null then raise exception 'Delivery address is required'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50 then raise exception 'Invalid order items'; end if;
  select * into v_user from umma_qa_20261013.telegram_users where telegram_id=p_staff_telegram_id and is_active=true;
  if not found or v_user.role not in ('super_admin','admin','employee') then raise exception 'Staff access denied'; end if;
  select * into v_location from umma_qa_20261013.locations where id=p_location_id and is_active=true and location_type in ('cafe','restaurant');
  if not found then raise exception 'Cafe location not found or inactive'; end if;
  if v_user.role<>'super_admin' then
    select staff_role into v_staff_role from umma_qa_20261013.cafe_staff where telegram_id=p_staff_telegram_id and location_id=p_location_id and is_active=true;
    if not found or v_staff_role not in ('manager','waiter','cashier','kitchen') then raise exception 'Staff cannot create orders'; end if;
  end if;
  insert into umma_qa_20261013.cafe_orders(customer_telegram_id,created_by_telegram_id,created_via,location_id,order_type,payment_method,customer_name,customer_phone,delivery_address,customer_note)
  values(null,p_staff_telegram_id,'staff',p_location_id,p_order_type,coalesce(nullif(p_payment_method,''),'cash'),coalesce(nullif(trim(p_customer_name),''),'Гость'),nullif(trim(p_customer_phone),''),nullif(trim(p_delivery_address),''),concat_ws(E'\\n',nullif(trim(p_customer_note),''),'Оформил сотрудник кафе'))
  returning * into v_order;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item)<>'object' or not(v_item?'productId') or not(v_item?'quantity') then raise exception 'Invalid item'; end if;
    v_quantity:=(v_item->>'quantity')::integer;
    if v_quantity<1 or v_quantity>99 then raise exception 'Invalid item quantity'; end if;
    select * into v_product from umma_qa_20261013.products where id=(v_item->>'productId')::uuid and product_type='cafe' and is_active=true;
    if not found then raise exception 'Product not found or unavailable'; end if;
    insert into umma_qa_20261013.cafe_order_items(order_id,product_id,product_name_ru,product_name_vi,product_name_en,quantity,unit_price_vnd)
    values(v_order.id,v_product.id,v_product.name_ru,v_product.name_vi,v_product.name_en,v_quantity,v_product.price_vnd);
    v_subtotal:=v_subtotal+v_product.price_vnd*v_quantity; v_item_count:=v_item_count+1;
  end loop;
  if v_item_count<1 then raise exception 'Order has no items'; end if;
  update umma_qa_20261013.cafe_orders set subtotal_vnd=v_subtotal,total_vnd=v_subtotal,updated_at=now() where id=v_order.id returning * into v_order;
  insert into umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note) values(v_order.id,p_staff_telegram_id,null,'pending','Order created by cafe staff');
  return jsonb_build_object('ok',true,'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'status',v_order.status,'orderType',v_order.order_type,'subtotalVnd',v_order.subtotal_vnd,'totalVnd',v_order.total_vnd,'createdAt',v_order.created_at));
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.get_cafe_accounting_summary(p_location_ids uuid[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'revenueVnd', coalesce((
      SELECT sum(o.total_vnd)::bigint FROM umma_qa_20261013.cafe_orders o
      WHERE o.location_id = ANY(coalesce(p_location_ids, ARRAY[]::uuid[]))
        AND o.payment_status='paid' AND o.status='completed'
    ),0),
    'completedPaidOrders', coalesce((
      SELECT count(*) FROM umma_qa_20261013.cafe_orders o
      WHERE o.location_id = ANY(coalesce(p_location_ids, ARRAY[]::uuid[]))
        AND o.payment_status='paid' AND o.status='completed'
    ),0),
    'cogsVnd', coalesce((
      SELECT round(sum(abs(m.quantity_delta)*m.unit_cost_vnd))::bigint FROM umma_qa_20261013.stock_movements m
      WHERE m.location_id = ANY(coalesce(p_location_ids, ARRAY[]::uuid[]))
        AND m.movement_type='sale_out'
    ),0),
    'operatingExpensesVnd', coalesce((
      SELECT sum(e.amount_vnd)::bigint FROM umma_qa_20261013.operating_expenses e
      WHERE e.location_id = ANY(coalesce(p_location_ids, ARRAY[]::uuid[]))
    ),0),
    'paidExpensesVnd', coalesce((
      SELECT sum(e.paid_amount_vnd)::bigint FROM umma_qa_20261013.operating_expenses e
      WHERE e.location_id = ANY(coalesce(p_location_ids, ARRAY[]::uuid[]))
    ),0),
    'postedPurchasesVnd', coalesce((
      SELECT sum(p.subtotal_vnd)::bigint FROM umma_qa_20261013.purchase_documents p
      WHERE p.location_id = ANY(coalesce(p_location_ids, ARRAY[]::uuid[])) AND p.status='posted'
    ),0),
    'stockValueVnd', coalesce((
      SELECT round(sum(b.quantity_on_hand*b.average_unit_cost_vnd))::bigint FROM umma_qa_20261013.stock_balances b
      WHERE b.location_id = ANY(coalesce(p_location_ids, ARRAY[]::uuid[]))
    ),0),
    'pendingCashHandoverVnd', coalesce((
      SELECT sum(h.amount_vnd)::bigint FROM umma_qa_20261013.cafe_cash_handovers h
      WHERE h.location_id = ANY(coalesce(p_location_ids, ARRAY[]::uuid[])) AND h.handover_status='pending'
    ),0),
    'pendingCashHandovers', coalesce((
      SELECT count(*) FROM umma_qa_20261013.cafe_cash_handovers h
      WHERE h.location_id = ANY(coalesce(p_location_ids, ARRAY[]::uuid[])) AND h.handover_status='pending'
    ),0)
  );
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.open_cafe_staff_shift(p_location_id uuid, p_actor_telegram_id bigint, p_staff_telegram_id bigint DEFAULT NULL::bigint, p_opening_cash_vnd integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013'
AS $function$
declare
  v_staff_id bigint := coalesce(p_staff_telegram_id, p_actor_telegram_id);
  v_actor_role text;
  v_target_role text;
  v_shift umma_qa_20261013.cafe_staff_shifts%rowtype;
begin
  if p_opening_cash_vnd is null or p_opening_cash_vnd < 0 then
    raise exception 'Начальная сумма не может быть отрицательной';
  end if;

  select role into v_actor_role
  from umma_qa_20261013.telegram_users
  where telegram_id = p_actor_telegram_id and is_active = true;
  if v_actor_role is null then raise exception 'Доступ запрещён'; end if;

  if v_actor_role <> 'super_admin' then
    select staff_role into v_target_role
    from umma_qa_20261013.cafe_staff
    where location_id = p_location_id and telegram_id = p_actor_telegram_id and is_active = true;
    if v_target_role is null then raise exception 'Нет доступа к этому кафе'; end if;
    if v_staff_id <> p_actor_telegram_id and v_target_role not in ('manager','cashier') then
      raise exception 'Только управляющий или кассир может открыть смену другого сотрудника';
    end if;
  end if;

  if not exists (
    select 1 from umma_qa_20261013.cafe_staff
    where location_id = p_location_id and telegram_id = v_staff_id and is_active = true
  ) then raise exception 'Сотрудник не назначен в это кафе'; end if;

  insert into umma_qa_20261013.cafe_staff_shifts(location_id, staff_telegram_id, opened_by_telegram_id, opening_cash_vnd)
  values (p_location_id, v_staff_id, p_actor_telegram_id, p_opening_cash_vnd)
  returning * into v_shift;

  return jsonb_build_object('ok', true, 'shift', to_jsonb(v_shift));
exception when unique_violation then
  raise exception 'У сотрудника уже есть открытая смена в этом кафе';
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.post_production_batch(p_batch_id uuid, p_actor_telegram_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
DECLARE
  v_batch umma_qa_20261013.production_batches%ROWTYPE;
  v_user umma_qa_20261013.telegram_users%ROWTYPE;
  v_item record;
  v_balance umma_qa_20261013.stock_balances%ROWTYPE;
  v_input_cost bigint := 0;
  v_output_qty numeric(14,3) := 0;
  v_unit_cost numeric(18,4) := 0;
  v_line_cost bigint := 0;
  v_actor_allowed boolean := false;
  v_product_type text;
BEGIN
  IF p_batch_id IS NULL OR p_actor_telegram_id IS NULL THEN
    RAISE EXCEPTION 'Invalid production posting request';
  END IF;

  SELECT * INTO v_user
  FROM umma_qa_20261013.telegram_users
  WHERE telegram_id = p_actor_telegram_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production management access denied'; END IF;

  SELECT * INTO v_batch
  FROM umma_qa_20261013.production_batches
  WHERE id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production batch not found'; END IF;

  v_actor_allowed := v_user.role = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM umma_qa_20261013.cafe_staff s
      WHERE s.telegram_id = p_actor_telegram_id
        AND s.location_id = v_batch.location_id
        AND s.staff_role = 'manager'
        AND s.is_active = true
    );
  IF NOT v_actor_allowed THEN RAISE EXCEPTION 'Production management access denied'; END IF;
  IF v_batch.status <> 'draft' THEN RAISE EXCEPTION 'Production batch must be a draft'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM umma_qa_20261013.production_batch_items
    WHERE production_batch_id = p_batch_id AND movement_direction = 'input'
  ) OR NOT EXISTS (
    SELECT 1 FROM umma_qa_20261013.production_batch_items
    WHERE production_batch_id = p_batch_id AND movement_direction = 'output'
  ) THEN
    RAISE EXCEPTION 'Production batch requires input and output items';
  END IF;

  SELECT coalesce(sum(quantity),0) INTO v_output_qty
  FROM umma_qa_20261013.production_batch_items
  WHERE production_batch_id = p_batch_id AND movement_direction = 'output';
  IF v_output_qty <= 0 THEN RAISE EXCEPTION 'Production output quantity must be positive'; END IF;

  -- First pass locks and validates every consumed stock balance, and calculates its actual cost.
  FOR v_item IN
    SELECT pbi.id, pbi.stock_item_id, pbi.quantity, pbi.movement_direction
    FROM umma_qa_20261013.production_batch_items pbi
    WHERE pbi.production_batch_id = p_batch_id
      AND pbi.movement_direction IN ('input','waste')
    ORDER BY pbi.stock_item_id, pbi.id
  LOOP
    SELECT * INTO v_balance
    FROM umma_qa_20261013.stock_balances
    WHERE location_id = v_batch.location_id AND stock_item_id = v_item.stock_item_id
    FOR UPDATE;
    IF NOT FOUND OR v_balance.quantity_on_hand - v_balance.quantity_reserved < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for production item %', v_item.stock_item_id;
    END IF;

    v_line_cost := round(v_item.quantity * v_balance.average_unit_cost_vnd)::bigint;
    v_input_cost := v_input_cost + v_line_cost;
    UPDATE umma_qa_20261013.production_batch_items
    SET unit_cost_vnd = v_balance.average_unit_cost_vnd, line_cost_vnd = v_line_cost
    WHERE id = v_item.id;
  END LOOP;

  v_unit_cost := v_input_cost::numeric / v_output_qty;

  -- Second pass applies movements; any failure rolls the whole posting back.
  FOR v_item IN
    SELECT pbi.id, pbi.stock_item_id, pbi.quantity, pbi.movement_direction, si.linked_product_id
    FROM umma_qa_20261013.production_batch_items pbi
    JOIN umma_qa_20261013.stock_items si ON si.id = pbi.stock_item_id
    WHERE pbi.production_batch_id = p_batch_id
    ORDER BY pbi.stock_item_id, pbi.movement_direction, pbi.id
  LOOP
    IF v_item.movement_direction IN ('input','waste') THEN
      SELECT * INTO v_balance FROM umma_qa_20261013.stock_balances
      WHERE location_id = v_batch.location_id AND stock_item_id = v_item.stock_item_id
      FOR UPDATE;
      v_line_cost := round(v_item.quantity * v_balance.average_unit_cost_vnd)::bigint;

      UPDATE umma_qa_20261013.stock_balances
      SET quantity_on_hand = quantity_on_hand - v_item.quantity, updated_at = now()
      WHERE id = v_balance.id;

      INSERT INTO umma_qa_20261013.stock_movements(
        location_id, stock_item_id, movement_type, quantity_delta, unit_cost_vnd,
        source_type, source_id, actor_telegram_id, note
      ) VALUES (
        v_batch.location_id, v_item.stock_item_id,
        CASE WHEN v_item.movement_direction = 'waste' THEN 'waste_out' ELSE 'production_out' END,
        -v_item.quantity, v_balance.average_unit_cost_vnd,
        'production_batch', v_batch.id, p_actor_telegram_id, 'Production consumption'
      );
    ELSE
      v_line_cost := round(v_item.quantity * v_unit_cost)::bigint;
      INSERT INTO umma_qa_20261013.stock_balances(location_id, stock_item_id, quantity_on_hand, quantity_reserved, average_unit_cost_vnd)
      VALUES (v_batch.location_id, v_item.stock_item_id, v_item.quantity, 0, v_unit_cost)
      ON CONFLICT (location_id, stock_item_id) DO UPDATE
      SET average_unit_cost_vnd =
            CASE WHEN umma_qa_20261013.stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand > 0
              THEN ((umma_qa_20261013.stock_balances.quantity_on_hand * umma_qa_20261013.stock_balances.average_unit_cost_vnd)
                    + (EXCLUDED.quantity_on_hand * EXCLUDED.average_unit_cost_vnd))
                   / (umma_qa_20261013.stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand)
              ELSE EXCLUDED.average_unit_cost_vnd END,
          quantity_on_hand = umma_qa_20261013.stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
          updated_at = now();

      UPDATE umma_qa_20261013.production_batch_items
      SET unit_cost_vnd = v_unit_cost, line_cost_vnd = v_line_cost
      WHERE id = v_item.id;

      INSERT INTO umma_qa_20261013.stock_movements(
        location_id, stock_item_id, movement_type, quantity_delta, unit_cost_vnd,
        source_type, source_id, actor_telegram_id, note
      ) VALUES (
        v_batch.location_id, v_item.stock_item_id, 'production_in',
        v_item.quantity, v_unit_cost, 'production_batch', v_batch.id,
        p_actor_telegram_id, 'Finished product received from production'
      );

      IF v_item.linked_product_id IS NOT NULL THEN
        SELECT product_type INTO v_product_type FROM umma_qa_20261013.products WHERE id = v_item.linked_product_id AND is_active = true;
        IF v_product_type = 'cafe' THEN
          INSERT INTO umma_qa_20261013.inventory(product_id, location_id, quantity, reserved_quantity, is_available)
          VALUES (v_item.linked_product_id, v_batch.location_id, v_item.quantity, 0, true)
          ON CONFLICT (product_id, location_id) DO UPDATE
          SET quantity = umma_qa_20261013.inventory.quantity + EXCLUDED.quantity,
              is_available = true,
              updated_at = now();
        END IF;
      END IF;
    END IF;
  END LOOP;

  UPDATE umma_qa_20261013.production_batches
  SET status = 'posted', actual_quantity = v_output_qty, total_cost_vnd = v_input_cost,
      posted_by_telegram_id = p_actor_telegram_id, posted_at = now(), updated_at = now()
  WHERE id = v_batch.id;

  RETURN jsonb_build_object(
    'ok', true, 'batchId', v_batch.id, 'status', 'posted',
    'outputQuantity', v_output_qty, 'totalCostVnd', v_input_cost,
    'unitCostVnd', round(v_unit_cost, 4)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.post_purchase_document(p_document_id uuid, p_actor_telegram_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
DECLARE
  v_doc umma_qa_20261013.purchase_documents%ROWTYPE;
  v_user umma_qa_20261013.telegram_users%ROWTYPE;
  v_item record;
  v_balance umma_qa_20261013.stock_balances%ROWTYPE;
  v_subtotal bigint := 0;
  v_actor_allowed boolean := false;
BEGIN
  IF p_document_id IS NULL OR p_actor_telegram_id IS NULL THEN
    RAISE EXCEPTION 'Invalid purchase posting request';
  END IF;

  SELECT * INTO v_user
  FROM umma_qa_20261013.telegram_users
  WHERE telegram_id = p_actor_telegram_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase management access denied'; END IF;

  SELECT * INTO v_doc
  FROM umma_qa_20261013.purchase_documents
  WHERE id = p_document_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase document not found'; END IF;

  v_actor_allowed := v_user.role = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM umma_qa_20261013.cafe_staff s
      WHERE s.telegram_id = p_actor_telegram_id
        AND s.location_id = v_doc.location_id
        AND s.staff_role = 'manager'
        AND s.is_active = true
    );
  IF NOT v_actor_allowed THEN RAISE EXCEPTION 'Purchase management access denied'; END IF;
  IF v_doc.status <> 'draft' THEN RAISE EXCEPTION 'Purchase document must be a draft'; END IF;

  IF NOT EXISTS (SELECT 1 FROM umma_qa_20261013.purchase_items WHERE purchase_document_id = p_document_id) THEN
    RAISE EXCEPTION 'Purchase document has no items';
  END IF;

  FOR v_item IN
    SELECT pi.id, pi.stock_item_id, pi.quantity, pi.unit_cost_vnd, si.is_active, si.linked_product_id
    FROM umma_qa_20261013.purchase_items pi
    JOIN umma_qa_20261013.stock_items si ON si.id = pi.stock_item_id
    WHERE pi.purchase_document_id = p_document_id
    ORDER BY pi.stock_item_id, pi.id
  LOOP
    IF v_item.is_active IS NOT TRUE THEN RAISE EXCEPTION 'Inactive stock item in purchase'; END IF;
    UPDATE umma_qa_20261013.purchase_items
      SET line_total_vnd = round(v_item.quantity * v_item.unit_cost_vnd)::bigint
      WHERE id = v_item.id;
    v_subtotal := v_subtotal + round(v_item.quantity * v_item.unit_cost_vnd)::bigint;

    SELECT * INTO v_balance
    FROM umma_qa_20261013.stock_balances
    WHERE location_id = v_doc.location_id AND stock_item_id = v_item.stock_item_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE umma_qa_20261013.stock_balances
      SET average_unit_cost_vnd =
            CASE WHEN quantity_on_hand + v_item.quantity > 0
              THEN ((quantity_on_hand * average_unit_cost_vnd) + (v_item.quantity * v_item.unit_cost_vnd))
                    / (quantity_on_hand + v_item.quantity)
              ELSE v_item.unit_cost_vnd END,
          quantity_on_hand = quantity_on_hand + v_item.quantity,
          updated_at = now()
      WHERE id = v_balance.id;
    ELSE
      INSERT INTO umma_qa_20261013.stock_balances(location_id, stock_item_id, quantity_on_hand, quantity_reserved, average_unit_cost_vnd)
      VALUES (v_doc.location_id, v_item.stock_item_id, v_item.quantity, 0, v_item.unit_cost_vnd);
    END IF;

    INSERT INTO umma_qa_20261013.stock_movements(
      location_id, stock_item_id, movement_type, quantity_delta, unit_cost_vnd,
      source_type, source_id, actor_telegram_id, note
    ) VALUES (
      v_doc.location_id, v_item.stock_item_id, 'purchase_in', v_item.quantity,
      v_item.unit_cost_vnd, 'purchase_document', v_doc.id, p_actor_telegram_id,
      coalesce(v_doc.document_number, 'Purchase ' || v_doc.id::text)
    );

    IF v_item.linked_product_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM umma_qa_20261013.products p
      WHERE p.id = v_item.linked_product_id AND p.product_type = 'cafe' AND p.is_active = true
    ) THEN
      INSERT INTO umma_qa_20261013.inventory(product_id, location_id, quantity, reserved_quantity, is_available)
      VALUES (v_item.linked_product_id, v_doc.location_id, v_item.quantity, 0, true)
      ON CONFLICT (product_id, location_id) DO UPDATE
      SET quantity = umma_qa_20261013.inventory.quantity + EXCLUDED.quantity,
          is_available = true,
          updated_at = now();
    END IF;
  END LOOP;

  UPDATE umma_qa_20261013.purchase_documents
  SET status = 'posted', subtotal_vnd = v_subtotal,
      posted_by_telegram_id = p_actor_telegram_id, posted_at = now(), updated_at = now()
  WHERE id = v_doc.id;

  RETURN jsonb_build_object('ok', true, 'documentId', v_doc.id, 'subtotalVnd', v_subtotal, 'status', 'posted');
END;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.record_operating_expense_payment(p_expense_id uuid, p_actor_telegram_id bigint, p_amount_vnd bigint, p_payment_method text, p_idempotency_key text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
DECLARE
  v_expense umma_qa_20261013.operating_expenses%ROWTYPE;
  v_user umma_qa_20261013.telegram_users%ROWTYPE;
  v_entry umma_qa_20261013.cafe_financial_entries%ROWTYPE;
  v_new_paid bigint;
  v_status text;
BEGIN
  IF p_expense_id IS NULL OR p_actor_telegram_id IS NULL OR p_amount_vnd IS NULL OR p_amount_vnd <= 0
    OR p_payment_method NOT IN ('cash','qr','bank_transfer','card','other')
    OR nullif(trim(p_idempotency_key),'') IS NULL OR length(p_idempotency_key)>160 THEN
    RAISE EXCEPTION 'Invalid expense payment';
  END IF;
  SELECT * INTO v_user FROM umma_qa_20261013.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense payment access denied'; END IF;
  SELECT * INTO v_expense FROM umma_qa_20261013.operating_expenses WHERE id=p_expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found'; END IF;
  IF NOT (v_user.role='super_admin' OR EXISTS (
    SELECT 1 FROM umma_qa_20261013.cafe_staff s WHERE s.telegram_id=p_actor_telegram_id
      AND s.location_id=v_expense.location_id AND s.staff_role='manager' AND s.is_active=true
  )) THEN RAISE EXCEPTION 'Expense payment access denied'; END IF;

  SELECT * INTO v_entry FROM umma_qa_20261013.cafe_financial_entries WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_entry.source_type<>'operating_expense' OR v_entry.source_id<>v_expense.id OR v_entry.amount_vnd<>p_amount_vnd THEN
      RAISE EXCEPTION 'Idempotency key already used for another transaction';
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'expenseId',v_expense.id,'paidAmountVnd',v_expense.paid_amount_vnd,'paymentStatus',v_expense.payment_status);
  END IF;

  IF v_expense.paid_amount_vnd + p_amount_vnd > v_expense.amount_vnd THEN RAISE EXCEPTION 'Payment exceeds outstanding expense amount'; END IF;
  v_new_paid := v_expense.paid_amount_vnd + p_amount_vnd;
  v_status := CASE WHEN v_new_paid=v_expense.amount_vnd THEN 'paid' WHEN v_new_paid>0 THEN 'partially_paid' ELSE 'unpaid' END;

  INSERT INTO umma_qa_20261013.cafe_financial_entries(location_id,transaction_type,category,amount_vnd,payment_method,source_type,source_id,actor_telegram_id,idempotency_key,notes)
  VALUES(v_expense.location_id,'expense',v_expense.category,p_amount_vnd,p_payment_method,'operating_expense',v_expense.id,p_actor_telegram_id,p_idempotency_key,nullif(left(p_note,500),''));

  UPDATE umma_qa_20261013.operating_expenses SET paid_amount_vnd=v_new_paid,payment_status=v_status,
    payment_method=p_payment_method,updated_at=now() WHERE id=v_expense.id;
  RETURN jsonb_build_object('ok',true,'expenseId',v_expense.id,'paidAmountVnd',v_new_paid,'paymentStatus',v_status,'remainingVnd',v_expense.amount_vnd-v_new_paid);
END;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.record_purchase_payment(p_document_id uuid, p_actor_telegram_id bigint, p_amount_vnd bigint, p_payment_method text, p_idempotency_key text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
DECLARE
  v_doc umma_qa_20261013.purchase_documents%ROWTYPE;
  v_user umma_qa_20261013.telegram_users%ROWTYPE;
  v_entry umma_qa_20261013.cafe_financial_entries%ROWTYPE;
  v_new_paid bigint;
  v_status text;
BEGIN
  IF p_document_id IS NULL OR p_actor_telegram_id IS NULL OR p_amount_vnd IS NULL OR p_amount_vnd <= 0
    OR p_payment_method NOT IN ('cash','qr','bank_transfer','card','other')
    OR nullif(trim(p_idempotency_key),'') IS NULL OR length(p_idempotency_key)>160 THEN
    RAISE EXCEPTION 'Invalid purchase payment';
  END IF;
  SELECT * INTO v_user FROM umma_qa_20261013.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase payment access denied'; END IF;
  SELECT * INTO v_doc FROM umma_qa_20261013.purchase_documents WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase document not found'; END IF;
  IF NOT (v_user.role='super_admin' OR EXISTS (
    SELECT 1 FROM umma_qa_20261013.cafe_staff s WHERE s.telegram_id=p_actor_telegram_id
      AND s.location_id=v_doc.location_id AND s.staff_role='manager' AND s.is_active=true
  )) THEN RAISE EXCEPTION 'Purchase payment access denied'; END IF;

  SELECT * INTO v_entry FROM umma_qa_20261013.cafe_financial_entries WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_entry.source_type<>'purchase_payment' OR v_entry.source_id<>v_doc.id OR v_entry.amount_vnd<>p_amount_vnd THEN
      RAISE EXCEPTION 'Idempotency key already used for another transaction';
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'documentId',v_doc.id,'paidAmountVnd',v_doc.paid_amount_vnd,'paymentStatus',v_doc.payment_status);
  END IF;

  IF v_doc.status<>'posted' THEN RAISE EXCEPTION 'Purchase must be posted before payment'; END IF;
  IF v_doc.paid_amount_vnd + p_amount_vnd > v_doc.subtotal_vnd THEN RAISE EXCEPTION 'Payment exceeds outstanding purchase amount'; END IF;
  v_new_paid := v_doc.paid_amount_vnd + p_amount_vnd;
  v_status := CASE WHEN v_new_paid=v_doc.subtotal_vnd THEN 'paid' WHEN v_new_paid>0 THEN 'partially_paid' ELSE 'unpaid' END;

  INSERT INTO umma_qa_20261013.cafe_financial_entries(location_id,transaction_type,category,amount_vnd,payment_method,source_type,source_id,actor_telegram_id,idempotency_key,notes)
  VALUES(v_doc.location_id,'expense','purchase',p_amount_vnd,p_payment_method,'purchase_payment',v_doc.id,p_actor_telegram_id,p_idempotency_key,nullif(left(p_note,500),''));

  UPDATE umma_qa_20261013.purchase_documents SET paid_amount_vnd=v_new_paid,payment_status=v_status,updated_at=now() WHERE id=v_doc.id;
  RETURN jsonb_build_object('ok',true,'documentId',v_doc.id,'paidAmountVnd',v_new_paid,'paymentStatus',v_status,'remainingVnd',v_doc.subtotal_vnd-v_new_paid);
END;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.reserve_cafe_inventory_for_order_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_location_id uuid;
  v_inventory umma_qa_20261013.inventory%rowtype;
  v_product umma_qa_20261013.products%rowtype;
  v_stock_item umma_qa_20261013.stock_items%rowtype;
  v_balance umma_qa_20261013.stock_balances%rowtype;
  v_inventory_control_enabled boolean := false;
begin
  select location_id into v_location_id from umma_qa_20261013.cafe_orders where id = new.order_id;
  if v_location_id is null then raise exception 'Cafe location is required for stock-managed orders'; end if;

  select * into v_product from umma_qa_20261013.products
  where id = new.product_id and product_type = 'cafe' and is_active = true;
  if not found then raise exception 'Product not found or unavailable'; end if;

  select coalesce((select inventory_control_enabled from umma_qa_20261013.umma_runtime_settings where id = true), false)
  into v_inventory_control_enabled;

  -- Staging mode: validate the product and price, but do not reserve or deduct
  -- fictional stock before the first physical inventory is entered.
  if not v_inventory_control_enabled then
    new.accounting_stock_item_id := null;
    new.unit_price_vnd := v_product.price_vnd;
    return new;
  end if;

  select * into v_inventory from umma_qa_20261013.inventory
  where product_id = new.product_id and location_id = v_location_id for update;
  if not found or not v_inventory.is_available then
    raise exception 'Товар недоступен в выбранном кафе';
  end if;
  if v_inventory.quantity - v_inventory.reserved_quantity < new.quantity then
    raise exception 'Недостаточно остатка: %', v_product.name_ru;
  end if;

  select * into v_stock_item from umma_qa_20261013.stock_items where linked_product_id = new.product_id and is_active = true;
  if found then
    select * into v_balance from umma_qa_20261013.stock_balances
    where location_id = v_location_id and stock_item_id = v_stock_item.id for update;
    if not found then
      raise exception 'Accounting stock is not initialized for product %', v_product.name_ru;
    end if;
    if v_balance.quantity_on_hand - v_balance.quantity_reserved < new.quantity then
      raise exception 'Недостаточно учётного остатка: %', v_product.name_ru;
    end if;
    update umma_qa_20261013.stock_balances
      set quantity_reserved = quantity_reserved + new.quantity, updated_at = now()
      where id = v_balance.id;
    new.accounting_stock_item_id := v_stock_item.id;
  else
    new.accounting_stock_item_id := null;
  end if;

  new.unit_price_vnd := coalesce(v_inventory.price_vnd, v_product.price_vnd);
  update umma_qa_20261013.inventory
    set reserved_quantity = reserved_quantity + new.quantity, updated_at = now()
    where id = v_inventory.id;

  insert into umma_qa_20261013.cafe_inventory_movements
    (location_id, product_id, order_id, actor_telegram_id, movement_type, quantity, note)
  values
    (v_location_id, new.product_id, new.order_id,
     (select coalesce(customer_telegram_id, created_by_telegram_id) from umma_qa_20261013.cafe_orders where id = new.order_id),
     'reserved', new.quantity, 'Stock reserved for order');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.respond_cafe_cash_handover(p_handover_id uuid, p_actor_telegram_id bigint, p_accept boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_handover umma_qa_20261013.cafe_cash_handovers%rowtype;
  v_user umma_qa_20261013.telegram_users%rowtype;
  v_actor_role text;
begin
  if p_handover_id is null or p_actor_telegram_id is null or p_accept is null then raise exception 'Invalid cash handover response'; end if;
  select * into v_handover from umma_qa_20261013.cafe_cash_handovers where id=p_handover_id for update;
  if not found then raise exception 'Cash handover not found'; end if;
  if v_handover.handover_status<>'pending' then raise exception 'Cash handover is no longer pending'; end if;
  if v_handover.to_telegram_id<>p_actor_telegram_id then raise exception 'Only the intended receiver can confirm this handover'; end if;
  select * into v_user from umma_qa_20261013.telegram_users where telegram_id=p_actor_telegram_id and is_active=true;
  if not found then raise exception 'Cash handover access denied'; end if;
  if v_user.role='super_admin' then v_actor_role:='manager';
  else
    if v_user.role not in ('admin','employee') then raise exception 'Cash handover access denied'; end if;
    select staff_role into v_actor_role from umma_qa_20261013.cafe_staff where telegram_id=p_actor_telegram_id and location_id=v_handover.location_id and is_active=true;
    if not found then raise exception 'Receiver has no active assignment for this cafe'; end if;
  end if;
  if v_actor_role not in ('manager','cashier') then raise exception 'Only cashier or administrator can receive cash'; end if;
  update umma_qa_20261013.cafe_cash_handovers set handover_status=case when p_accept then 'accepted' else 'rejected' end,
    accepted_at=case when p_accept then now() else null end,
    accepted_by_telegram_id=case when p_accept then p_actor_telegram_id else null end,
    note=concat_ws(' · ',nullif(note,''),nullif(trim(p_note),''))
  where id=p_handover_id returning * into v_handover;
  return jsonb_build_object('ok',true,'handover',jsonb_build_object('id',v_handover.id,'status',v_handover.handover_status,'acceptedAt',v_handover.accepted_at));
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.seed_cafe_inventory_for_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
begin
 if new.location_type in ('cafe','restaurant') and new.is_active=true then
   insert into umma_qa_20261013.inventory(product_id,location_id,quantity,reserved_quantity,is_available)
   select p.id,new.id,0,0,true from umma_qa_20261013.products p where p.product_type='cafe' and p.is_active=true
   on conflict(product_id,location_id) do nothing;
 end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.seed_cafe_inventory_for_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
begin
 if new.product_type='cafe' and new.is_active=true then
   insert into umma_qa_20261013.inventory(product_id,location_id,quantity,reserved_quantity,is_available)
   select new.id,l.id,0,0,true from umma_qa_20261013.locations l
   where l.location_type in ('cafe','restaurant') and l.is_active=true
   on conflict(product_id,location_id) do nothing;
 end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.set_accounting_stock_balance(p_location_id uuid, p_stock_item_id uuid, p_counted_quantity numeric, p_actor_telegram_id bigint, p_unit_cost_vnd numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
DECLARE
  v_user umma_qa_20261013.telegram_users%ROWTYPE;
  v_item umma_qa_20261013.stock_items%ROWTYPE;
  v_balance umma_qa_20261013.stock_balances%ROWTYPE;
  v_old_qty numeric(14,3) := 0;
  v_delta numeric(14,3);
  v_cost numeric(18,4) := 0;
  v_reserved numeric(14,3) := 0;
  v_inventory_found boolean := false;
BEGIN
  IF p_location_id IS NULL OR p_stock_item_id IS NULL OR p_actor_telegram_id IS NULL
    OR p_counted_quantity IS NULL OR p_counted_quantity < 0
    OR p_counted_quantity > 999999999
    OR (p_unit_cost_vnd IS NOT NULL AND p_unit_cost_vnd < 0) THEN
    RAISE EXCEPTION 'Invalid stock count';
  END IF;

  SELECT * INTO v_user FROM umma_qa_20261013.telegram_users
  WHERE telegram_id=p_actor_telegram_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock management access denied'; END IF;
  IF NOT (v_user.role='super_admin' OR EXISTS (
    SELECT 1 FROM umma_qa_20261013.cafe_staff s WHERE s.telegram_id=p_actor_telegram_id
      AND s.location_id=p_location_id AND s.staff_role='manager' AND s.is_active=true
  )) THEN RAISE EXCEPTION 'Stock management access denied'; END IF;

  IF NOT EXISTS (SELECT 1 FROM umma_qa_20261013.locations WHERE id=p_location_id AND is_active=true) THEN
    RAISE EXCEPTION 'Location not found or inactive';
  END IF;
  SELECT * INTO v_item FROM umma_qa_20261013.stock_items WHERE id=p_stock_item_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found or inactive'; END IF;

  SELECT * INTO v_balance FROM umma_qa_20261013.stock_balances
  WHERE location_id=p_location_id AND stock_item_id=p_stock_item_id
  FOR UPDATE;
  IF FOUND THEN
    v_old_qty := v_balance.quantity_on_hand;
    v_reserved := v_balance.quantity_reserved;
    v_cost := coalesce(p_unit_cost_vnd, v_balance.average_unit_cost_vnd);
  ELSE
    v_old_qty := 0;
    v_reserved := 0;
    v_cost := coalesce(p_unit_cost_vnd,0);
  END IF;

  IF p_counted_quantity < v_reserved THEN
    RAISE EXCEPTION 'Counted stock cannot be lower than reserved quantity';
  END IF;

  IF v_item.linked_product_id IS NOT NULL THEN
    SELECT coalesce(reserved_quantity,0) INTO v_reserved
    FROM umma_qa_20261013.inventory
    WHERE product_id=v_item.linked_product_id AND location_id=p_location_id
    FOR UPDATE;
    v_inventory_found := FOUND;
    IF v_inventory_found AND p_counted_quantity < v_reserved THEN
      RAISE EXCEPTION 'Counted stock cannot be lower than active order reservations';
    END IF;
  END IF;

  INSERT INTO umma_qa_20261013.stock_balances(location_id,stock_item_id,quantity_on_hand,quantity_reserved,average_unit_cost_vnd)
  VALUES(p_location_id,p_stock_item_id,p_counted_quantity,
    CASE WHEN v_inventory_found THEN v_reserved ELSE 0 END,v_cost)
  ON CONFLICT(location_id,stock_item_id) DO UPDATE
  SET quantity_on_hand=EXCLUDED.quantity_on_hand,
      quantity_reserved=CASE WHEN v_inventory_found THEN v_reserved ELSE umma_qa_20261013.stock_balances.quantity_reserved END,
      average_unit_cost_vnd=CASE WHEN p_unit_cost_vnd IS NOT NULL THEN p_unit_cost_vnd ELSE umma_qa_20261013.stock_balances.average_unit_cost_vnd END,
      updated_at=now();

  v_delta := p_counted_quantity-v_old_qty;
  IF v_delta <> 0 THEN
    INSERT INTO umma_qa_20261013.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,actor_telegram_id,note)
    VALUES(p_location_id,p_stock_item_id,CASE WHEN v_delta>0 THEN 'adjustment_in' ELSE 'adjustment_out' END,
      v_delta,v_cost,'manual_adjustment',p_actor_telegram_id,coalesce(nullif(left(trim(p_note),500),''),'Physical stock count'));
  END IF;

  IF v_item.linked_product_id IS NOT NULL THEN
    INSERT INTO umma_qa_20261013.inventory(product_id,location_id,quantity,reserved_quantity,is_available)
    VALUES(v_item.linked_product_id,p_location_id,p_counted_quantity,CASE WHEN v_inventory_found THEN v_reserved ELSE 0 END,true)
    ON CONFLICT(product_id,location_id) DO UPDATE
    SET quantity=EXCLUDED.quantity,
        reserved_quantity=CASE WHEN v_inventory_found THEN v_reserved ELSE umma_qa_20261013.inventory.reserved_quantity END,
        is_available=true,
        updated_at=now();
  END IF;

  RETURN jsonb_build_object('ok',true,'locationId',p_location_id,'stockItemId',p_stock_item_id,
    'oldQuantity',v_old_qty,'countedQuantity',p_counted_quantity,'delta',v_delta,'averageUnitCostVnd',v_cost);
END;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.set_cafe_order_delivery_status_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
begin
  if NEW.order_type = 'delivery' then
    if NEW.delivery_status is null or NEW.delivery_status = 'not_applicable' then
      NEW.delivery_status := 'waiting_courier';
    end if;
  else
    NEW.delivery_status := 'not_applicable';
    NEW.courier_telegram_id := null;
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.sync_cafe_order_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare v_subtotal integer;
begin
 if new.subtotal_vnd is distinct from old.subtotal_vnd or new.total_vnd is distinct from old.total_vnd then
   select coalesce(sum(line_total_vnd),0)::integer into v_subtotal from umma_qa_20261013.cafe_order_items where order_id=new.id;
   new.subtotal_vnd:=v_subtotal;
   new.total_vnd:=greatest(0,v_subtotal+coalesce(new.delivery_fee_vnd,0)-coalesce(new.discount_vnd,0));
 end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.update_cafe_delivery_status(p_order_id uuid, p_actor_telegram_id bigint, p_delivery_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
 v_order umma_qa_20261013.cafe_orders%rowtype;
 v_user umma_qa_20261013.telegram_users%rowtype;
 v_staff_role text;
 v_previous text;
 v_allowed boolean := false;
begin
 if p_order_id is null or p_actor_telegram_id is null then raise exception 'Invalid delivery update request'; end if;
 if p_delivery_status not in ('waiting_courier','courier_assigned','picked_up','delivered') then raise exception 'Invalid delivery status'; end if;
 select * into v_user from umma_qa_20261013.telegram_users where telegram_id=p_actor_telegram_id and is_active=true;
 if not found then raise exception 'Delivery management access denied'; end if;
 select * into v_order from umma_qa_20261013.cafe_orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.order_type <> 'delivery' then raise exception 'Order is not delivery'; end if;
 if v_user.role='super_admin' then v_staff_role:='manager';
 else
   if v_user.role not in ('admin','employee') then raise exception 'Delivery management access denied'; end if;
   select staff_role into v_staff_role from umma_qa_20261013.cafe_staff where telegram_id=p_actor_telegram_id and location_id=v_order.location_id and is_active=true;
   if not found then raise exception 'No active staff assignment for this cafe'; end if;
 end if;
 if v_staff_role not in ('manager','waiter','cashier','courier') then raise exception 'Staff role cannot update delivery'; end if;
 if v_staff_role='courier' and v_order.courier_telegram_id is distinct from p_actor_telegram_id then
   raise exception 'Delivery assigned to another courier';
 end if;
 v_previous:=v_order.delivery_status;
 v_allowed:=case
   when v_staff_role='courier' and v_previous='courier_assigned' and p_delivery_status='picked_up' then true
   when v_staff_role='courier' and v_previous='picked_up' and p_delivery_status='delivered' then true
   when v_staff_role<>'courier' and v_previous='waiting_courier' and p_delivery_status='courier_assigned' then true
   when v_staff_role<>'courier' and v_previous='courier_assigned' and p_delivery_status='picked_up' then true
   when v_staff_role<>'courier' and v_previous='picked_up' and p_delivery_status='delivered' then true
   when v_staff_role<>'courier' and p_delivery_status='waiting_courier' and v_previous='courier_assigned' then true
   else false end;
 if not v_allowed then raise exception 'Invalid delivery status transition'; end if;
 update umma_qa_20261013.cafe_orders set delivery_status=p_delivery_status,updated_at=now() where id=p_order_id returning * into v_order;
 insert into umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
 values(v_order.id,p_actor_telegram_id,v_previous,p_delivery_status,coalesce(nullif(trim(p_note),''),'Статус доставки обновлён'));
 return jsonb_build_object('ok',true,'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'deliveryStatus',v_order.delivery_status));
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.update_cafe_order_payment(p_order_id uuid, p_actor_telegram_id bigint, p_payment_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_order umma_qa_20261013.cafe_orders%rowtype;
  v_user umma_qa_20261013.telegram_users%rowtype;
  v_staff_role text;
  v_can_accept_payments boolean := false;
  v_previous text;
begin
  if p_order_id is null or p_actor_telegram_id is null then
    raise exception 'Invalid payment update request';
  end if;
  if p_payment_status not in ('paid','pending') then
    raise exception 'Invalid payment status';
  end if;

  select * into v_user from umma_qa_20261013.telegram_users
  where telegram_id = p_actor_telegram_id and is_active = true;
  if not found then raise exception 'Payment management access denied'; end if;

  select * into v_order from umma_qa_20261013.cafe_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if v_user.role = 'super_admin' then
    v_staff_role := 'manager';
    v_can_accept_payments := true;
  else
    if v_user.role not in ('admin','employee') then
      raise exception 'Payment management access denied';
    end if;
    select staff_role, can_accept_payments into v_staff_role, v_can_accept_payments
    from umma_qa_20261013.cafe_staff
    where telegram_id = p_actor_telegram_id and location_id = v_order.location_id and is_active = true;
    if not found then raise exception 'No active staff assignment for this cafe'; end if;
    if coalesce(v_can_accept_payments, false) is not true then
      raise exception 'Payment acceptance permission denied';
    end if;
  end if;

  if v_staff_role not in ('manager','cashier','waiter','kitchen','courier') then
    raise exception 'Staff role cannot update payment';
  end if;

  v_previous := v_order.payment_status;

  if p_payment_status = 'paid' and v_previous <> 'paid' then
    insert into umma_qa_20261013.cafe_payment_receipts
      (order_id, location_id, collected_by_telegram_id, payment_method, amount_vnd, receipt_status, note)
    values
      (v_order.id, v_order.location_id, p_actor_telegram_id, v_order.payment_method,
       v_order.total_vnd, 'confirmed', coalesce(nullif(trim(p_note),''),'Оплата заказа подтверждена'));
  elsif p_payment_status = 'pending' and v_previous = 'paid' then
    update umma_qa_20261013.cafe_payment_receipts
       set receipt_status = 'voided',
           note = concat_ws(' · ', nullif(note,''), coalesce(nullif(trim(p_note),''),'Оплата возвращена в ожидание'))
     where order_id = v_order.id and receipt_status = 'confirmed';
  end if;

  update umma_qa_20261013.cafe_orders
  set payment_status = p_payment_status,
      paid_at = case when p_payment_status = 'paid' then coalesce(paid_at,now()) else null end,
      paid_by_telegram_id = case when p_payment_status = 'paid' then p_actor_telegram_id else null end,
      updated_at = now()
  where id = p_order_id returning * into v_order;

  -- cafe_order_events stores order lifecycle statuses, not payment statuses.
  insert into umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
  values (
    v_order.id, p_actor_telegram_id, v_order.status, v_order.status,
    concat_ws(' · ',
      coalesce(nullif(trim(p_note),''), 'Payment updated'),
      'Payment: ' || coalesce(v_previous,'unknown') || ' → ' || p_payment_status)
  );

  return jsonb_build_object(
    'ok',true,
    'order',jsonb_build_object(
      'id',v_order.id,'orderNumber',v_order.order_number,
      'paymentStatus',v_order.payment_status,'paidAt',v_order.paid_at,
      'paidByTelegramId',v_order.paid_by_telegram_id
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.update_cafe_order_payment_cash(p_order_id uuid, p_actor_telegram_id bigint, p_payment_status text, p_note text DEFAULT NULL::text, p_tendered_amount_vnd integer DEFAULT NULL::integer, p_change_given_vnd integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_order umma_qa_20261013.cafe_orders%rowtype;
  v_result jsonb;
begin
  select * into v_order from umma_qa_20261013.cafe_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if p_payment_status = 'paid' and v_order.payment_status = 'paid' then
    raise exception 'Payment already confirmed';
  end if;

  if p_payment_status = 'paid' and v_order.payment_method = 'cash' then
    if p_tendered_amount_vnd is null or p_change_given_vnd is null
       or p_tendered_amount_vnd < v_order.total_vnd
       or p_change_given_vnd <> p_tendered_amount_vnd - v_order.total_vnd then
      raise exception 'Invalid cash received amount or change';
    end if;
  end if;

  v_result := umma_qa_20261013.update_cafe_order_payment(p_order_id, p_actor_telegram_id, p_payment_status, p_note);

  if p_payment_status = 'paid' and v_order.payment_method = 'cash' then
    update umma_qa_20261013.cafe_payment_receipts
       set tendered_amount_vnd = p_tendered_amount_vnd,
           change_given_vnd = p_change_given_vnd
     where id = (
       select id from umma_qa_20261013.cafe_payment_receipts
        where order_id = p_order_id
          and collected_by_telegram_id = p_actor_telegram_id
          and receipt_status = 'confirmed'
        order by collected_at desc, created_at desc
        limit 1
     );
    if not found then raise exception 'Cash receipt was not recorded'; end if;
  end if;
  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.update_cafe_order_status(p_order_id uuid, p_actor_telegram_id bigint, p_new_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
DECLARE
  v_order umma_qa_20261013.cafe_orders%ROWTYPE;
  v_user umma_qa_20261013.telegram_users%ROWTYPE;
  v_staff_role text;
  v_previous_status text;
  v_allowed boolean:=false;
  v_item record;
  v_balance umma_qa_20261013.stock_balances%ROWTYPE;
BEGIN
  IF p_order_id IS NULL OR p_actor_telegram_id IS NULL THEN RAISE EXCEPTION 'Invalid order update request'; END IF;
  IF p_new_status NOT IN ('confirmed','preparing','ready','completed','cancelled') THEN RAISE EXCEPTION 'Invalid order status'; END IF;

  SELECT * INTO v_user FROM umma_qa_20261013.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order management access denied'; END IF;
  SELECT * INTO v_order FROM umma_qa_20261013.cafe_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_previous_status:=v_order.status;
  IF p_new_status=v_previous_status THEN RAISE EXCEPTION 'Order already has this status'; END IF;
  IF p_new_status='completed' AND v_order.payment_status<>'paid' THEN RAISE EXCEPTION 'Order cannot be completed before payment is confirmed'; END IF;
  IF p_new_status='completed' AND v_order.order_type='delivery' AND coalesce(v_order.delivery_status,'waiting_courier')<>'delivered' THEN RAISE EXCEPTION 'Delivery must be confirmed before completing the order'; END IF;

  IF v_user.role='super_admin' THEN
    v_staff_role:='manager';
  ELSE
    IF v_user.role NOT IN ('admin','employee') THEN RAISE EXCEPTION 'Order management access denied'; END IF;
    SELECT staff_role INTO v_staff_role FROM umma_qa_20261013.cafe_staff
    WHERE telegram_id=p_actor_telegram_id AND location_id=v_order.location_id AND is_active=true;
    IF NOT FOUND THEN RAISE EXCEPTION 'No active staff assignment for this cafe'; END IF;
  END IF;

  -- All assigned non-courier cafe staff share the same fulfillment permissions.
  IF v_staff_role IN ('manager','cashier','waiter','kitchen') THEN
    v_allowed:=CASE
      WHEN v_previous_status='pending' AND p_new_status IN ('confirmed','cancelled') THEN true
      WHEN v_previous_status='confirmed' AND p_new_status IN ('preparing','cancelled') THEN true
      WHEN v_previous_status='preparing' AND p_new_status IN ('ready','cancelled') THEN true
      WHEN v_previous_status='ready' AND p_new_status IN ('completed','cancelled') THEN true
      ELSE false
    END;
  END IF;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Staff role cannot perform this order status transition'; END IF;

  IF p_new_status='confirmed' THEN
    IF v_order.status<>'pending' OR v_order.accepted_by_telegram_id IS NOT NULL THEN RAISE EXCEPTION 'Order already accepted by another employee'; END IF;
    UPDATE umma_qa_20261013.cafe_orders SET status='confirmed',accepted_by_telegram_id=p_actor_telegram_id,accepted_at=now(),confirmed_at=now(),updated_at=now()
    WHERE id=p_order_id RETURNING * INTO v_order;
  ELSE
    UPDATE umma_qa_20261013.cafe_orders SET status=p_new_status,updated_at=now(),
      completed_at=CASE WHEN p_new_status='completed' THEN now() ELSE completed_at END,
      cancelled_at=CASE WHEN p_new_status='cancelled' THEN now() ELSE cancelled_at END
    WHERE id=p_order_id RETURNING * INTO v_order;
  END IF;

  IF p_new_status='cancelled' THEN
    IF coalesce((SELECT inventory_control_enabled FROM umma_qa_20261013.umma_runtime_settings WHERE id=true),false) THEN
    FOR v_item IN
      SELECT product_id,quantity,accounting_stock_item_id
      FROM umma_qa_20261013.cafe_order_items WHERE order_id=v_order.id AND product_id IS NOT NULL
    LOOP
      UPDATE umma_qa_20261013.inventory SET reserved_quantity=greatest(0,reserved_quantity-v_item.quantity),updated_at=now()
      WHERE product_id=v_item.product_id AND location_id=v_order.location_id;
      IF v_item.accounting_stock_item_id IS NOT NULL THEN
        UPDATE umma_qa_20261013.stock_balances SET quantity_reserved=greatest(0,quantity_reserved-v_item.quantity),updated_at=now()
        WHERE stock_item_id=v_item.accounting_stock_item_id AND location_id=v_order.location_id;
      END IF;
      INSERT INTO umma_qa_20261013.cafe_inventory_movements(location_id,product_id,order_id,actor_telegram_id,movement_type,quantity,note)
      VALUES(v_order.location_id,v_item.product_id,v_order.id,p_actor_telegram_id,'released',v_item.quantity,'Order cancelled; stock released');
    END LOOP;
    END IF;
  ELSIF p_new_status='completed' THEN
    IF coalesce((SELECT inventory_control_enabled FROM umma_qa_20261013.umma_runtime_settings WHERE id=true),false) THEN
    FOR v_item IN
      SELECT id,product_id,quantity,accounting_stock_item_id
      FROM umma_qa_20261013.cafe_order_items WHERE order_id=v_order.id AND product_id IS NOT NULL
      ORDER BY accounting_stock_item_id NULLS LAST, id
    LOOP
      UPDATE umma_qa_20261013.inventory SET quantity=greatest(0,quantity-v_item.quantity),
        reserved_quantity=greatest(0,reserved_quantity-v_item.quantity),updated_at=now()
      WHERE product_id=v_item.product_id AND location_id=v_order.location_id;

      IF v_item.accounting_stock_item_id IS NOT NULL THEN
        SELECT * INTO v_balance FROM umma_qa_20261013.stock_balances
        WHERE location_id=v_order.location_id AND stock_item_id=v_item.accounting_stock_item_id FOR UPDATE;
        IF NOT FOUND OR v_balance.quantity_on_hand < v_item.quantity OR v_balance.quantity_reserved < v_item.quantity THEN
          RAISE EXCEPTION 'Accounting stock or reservation mismatch for product %', v_item.product_id;
        END IF;
        UPDATE umma_qa_20261013.stock_balances
        SET quantity_on_hand=quantity_on_hand-v_item.quantity,
            quantity_reserved=quantity_reserved-v_item.quantity,updated_at=now()
        WHERE id=v_balance.id;

        INSERT INTO umma_qa_20261013.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id,note)
        VALUES(v_order.location_id,v_item.accounting_stock_item_id,'sale_out',-v_item.quantity,
          v_balance.average_unit_cost_vnd,'order',v_order.id,p_actor_telegram_id,'Completed order; cost of goods sold');
      END IF;

      INSERT INTO umma_qa_20261013.cafe_inventory_movements(location_id,product_id,order_id,actor_telegram_id,movement_type,quantity,note)
      VALUES(v_order.location_id,v_item.product_id,v_order.id,p_actor_telegram_id,'sold',v_item.quantity,'Order completed; stock deducted');
    END LOOP;
    END IF;
  END IF;

  INSERT INTO umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
  VALUES(v_order.id,p_actor_telegram_id,v_previous_status,p_new_status,nullif(trim(p_note),''));

  RETURN jsonb_build_object('ok',true,'order',jsonb_build_object(
    'id',v_order.id,'orderNumber',v_order.order_number,'status',v_order.status,
    'acceptedByTelegramId',v_order.accepted_by_telegram_id,'acceptedAt',v_order.accepted_at,'updatedAt',v_order.updated_at));
END;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.update_translation_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.validate_production_batch_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
DECLARE v_item_type text;
BEGIN
  IF NEW.movement_direction = 'output' THEN
    SELECT item_type INTO v_item_type
    FROM umma_qa_20261013.stock_items
    WHERE id = NEW.stock_item_id AND is_active = true;
    IF v_item_type IS DISTINCT FROM 'finished_good' THEN
      RAISE EXCEPTION 'Production output must be an active finished-good stock item';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.validate_stock_item_product_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
DECLARE v_product umma_qa_20261013.products%ROWTYPE;
BEGIN
  IF NEW.linked_product_id IS NOT NULL THEN
    IF NEW.item_type <> 'finished_good' OR NEW.base_unit NOT IN ('pcs','portion') THEN
      RAISE EXCEPTION 'Only finished goods counted in pieces or portions can link to cafe menu products';
    END IF;
    SELECT * INTO v_product FROM umma_qa_20261013.products WHERE id=NEW.linked_product_id;
    IF NOT FOUND OR v_product.product_type <> 'cafe' OR v_product.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Linked menu product must be active and belong to a cafe';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE INDEX stock_movements_source_idx ON umma_qa_20261013.stock_movements USING btree (source_type, source_id);
CREATE INDEX stock_movements_location_stock_item_idx ON umma_qa_20261013.stock_movements USING btree (location_id, stock_item_id, created_at DESC);
CREATE UNIQUE INDEX production_batch_single_output_idx ON umma_qa_20261013.production_batch_items USING btree (production_batch_id) WHERE (movement_direction = 'output'::text);
CREATE UNIQUE INDEX production_batch_item_unique_line_idx ON umma_qa_20261013.production_batch_items USING btree (production_batch_id, stock_item_id, movement_direction);
CREATE INDEX cafe_order_items_accounting_stock_item_idx ON umma_qa_20261013.cafe_order_items USING btree (accounting_stock_item_id);
CREATE INDEX cafe_transfer_proofs_order_idx ON umma_qa_20261013.cafe_transfer_proofs USING btree (order_id, created_at DESC);
CREATE UNIQUE INDEX cafe_one_open_bill_per_numbered_table ON umma_qa_20261013.cafe_orders USING btree (location_id, regexp_replace(lower(TRIM(BOTH FROM customer_name)), '[[:space:]№]+'::text, ''::text, 'g'::text)) WHERE ((order_type = 'dine_in'::text) AND (payment_status <> 'paid'::text) AND (status <> ALL (ARRAY['completed'::text, 'cancelled'::text])) AND (customer_name ~* '^Стол[[:space:]]*№?[[:space:]]*[1-6]$'::text) AND (location_id IS NOT NULL));
CREATE INDEX cafe_cash_handovers_location_created_idx ON umma_qa_20261013.cafe_cash_handovers USING btree (location_id, created_at DESC);
CREATE INDEX cafe_cash_handovers_from_status_idx ON umma_qa_20261013.cafe_cash_handovers USING btree (from_telegram_id, handover_status, created_at DESC);
CREATE INDEX cafe_cash_handovers_to_status_idx ON umma_qa_20261013.cafe_cash_handovers USING btree (to_telegram_id, handover_status, created_at DESC);
CREATE INDEX idx_locations_type ON umma_qa_20261013.locations USING btree (location_type);
CREATE INDEX idx_locations_active ON umma_qa_20261013.locations USING btree (is_active);
CREATE INDEX idx_categories_type ON umma_qa_20261013.categories USING btree (category_type);
CREATE INDEX idx_categories_active ON umma_qa_20261013.categories USING btree (is_active);
CREATE INDEX idx_products_category ON umma_qa_20261013.products USING btree (category_id);
CREATE INDEX idx_products_type ON umma_qa_20261013.products USING btree (product_type);
CREATE INDEX idx_products_active ON umma_qa_20261013.products USING btree (is_active);
CREATE INDEX idx_inventory_product ON umma_qa_20261013.inventory USING btree (product_id);
CREATE INDEX idx_inventory_location ON umma_qa_20261013.inventory USING btree (location_id);
CREATE INDEX idx_translation_messages_sender ON umma_qa_20261013.translation_messages USING btree (sender_telegram_id);
CREATE INDEX idx_translation_messages_receiver ON umma_qa_20261013.translation_messages USING btree (receiver_telegram_id);
CREATE INDEX idx_translation_messages_created ON umma_qa_20261013.translation_messages USING btree (created_at DESC);
CREATE INDEX idx_voice_sessions_client ON umma_qa_20261013.voice_sessions USING btree (client_telegram_id);
CREATE INDEX idx_voice_sessions_staff ON umma_qa_20261013.voice_sessions USING btree (staff_telegram_id);
CREATE INDEX idx_voice_turns_session ON umma_qa_20261013.voice_turns USING btree (session_id);
CREATE INDEX idx_voice_turns_created ON umma_qa_20261013.voice_turns USING btree (created_at DESC);
CREATE INDEX telegram_users_telegram_id_idx ON umma_qa_20261013.telegram_users USING btree (telegram_id);
CREATE INDEX telegram_users_username_idx ON umma_qa_20261013.telegram_users USING btree (username);
CREATE INDEX cafe_financial_entries_source_idx ON umma_qa_20261013.cafe_financial_entries USING btree (source_type, source_id);
CREATE INDEX cafe_staff_location_active_idx ON umma_qa_20261013.cafe_staff USING btree (location_id, is_active, staff_role);
CREATE INDEX cafe_orders_customer_created_idx ON umma_qa_20261013.cafe_orders USING btree (customer_telegram_id, created_at DESC);
CREATE INDEX cafe_orders_status_created_idx ON umma_qa_20261013.cafe_orders USING btree (status, created_at);
CREATE INDEX cafe_orders_location_status_idx ON umma_qa_20261013.cafe_orders USING btree (location_id, status, created_at);
CREATE INDEX cafe_order_items_order_idx ON umma_qa_20261013.cafe_order_items USING btree (order_id);
CREATE INDEX cafe_order_events_order_created_idx ON umma_qa_20261013.cafe_order_events USING btree (order_id, created_at);
CREATE INDEX cafe_staff_telegram_active_idx ON umma_qa_20261013.cafe_staff USING btree (telegram_id, is_active);
CREATE INDEX cafe_payment_receipts_location_collected_idx ON umma_qa_20261013.cafe_payment_receipts USING btree (location_id, collected_at DESC);
CREATE INDEX cafe_payment_receipts_order_idx ON umma_qa_20261013.cafe_payment_receipts USING btree (order_id, collected_at DESC);
CREATE INDEX cafe_payment_receipts_collector_idx ON umma_qa_20261013.cafe_payment_receipts USING btree (collected_by_telegram_id, collected_at DESC);
CREATE INDEX cafe_order_events_actor_idx ON umma_qa_20261013.cafe_order_events USING btree (actor_telegram_id);
CREATE INDEX cafe_order_items_product_idx ON umma_qa_20261013.cafe_order_items USING btree (product_id);
CREATE UNIQUE INDEX cafe_staff_shifts_one_open_per_staff ON umma_qa_20261013.cafe_staff_shifts USING btree (location_id, staff_telegram_id) WHERE (shift_status = 'open'::text);
CREATE INDEX cafe_staff_shifts_location_opened ON umma_qa_20261013.cafe_staff_shifts USING btree (location_id, opened_at DESC);
CREATE UNIQUE INDEX cafe_test_one_open_shift_per_role ON umma_qa_20261013.cafe_test_shifts USING btree (location_id, actor_telegram_id, simulated_role) WHERE (shift_status = 'open'::text);
CREATE UNIQUE INDEX inventory_product_location_unique ON umma_qa_20261013.inventory USING btree (product_id, location_id);
CREATE INDEX cafe_inventory_movements_location_created ON umma_qa_20261013.cafe_inventory_movements USING btree (location_id, created_at DESC);
CREATE UNIQUE INDEX cafe_one_active_manager_per_location ON umma_qa_20261013.cafe_staff USING btree (location_id) WHERE ((is_active = true) AND (staff_role = 'manager'::text));
CREATE INDEX cafe_inventory_movements_location_product_idx ON umma_qa_20261013.cafe_inventory_movements USING btree (location_id, product_id, created_at DESC);
CREATE INDEX purchase_documents_location_date_idx ON umma_qa_20261013.purchase_documents USING btree (location_id, purchase_date DESC);
CREATE INDEX purchase_items_document_idx ON umma_qa_20261013.purchase_items USING btree (purchase_document_id);
CREATE INDEX stock_balances_location_idx ON umma_qa_20261013.stock_balances USING btree (location_id);
CREATE INDEX recipes_product_active_idx ON umma_qa_20261013.recipes USING btree (product_id, is_active);
CREATE INDEX production_batches_location_date_idx ON umma_qa_20261013.production_batches USING btree (location_id, production_date DESC);
CREATE INDEX operating_expenses_location_date_idx ON umma_qa_20261013.operating_expenses USING btree (location_id, expense_date DESC);
CREATE INDEX cafe_financial_entries_location_time_idx ON umma_qa_20261013.cafe_financial_entries USING btree (location_id, transaction_at DESC);
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON umma_qa_20261013.user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER translation_settings_updated_at BEFORE UPDATE ON umma_qa_20261013.translation_settings FOR EACH ROW EXECUTE FUNCTION update_translation_settings_updated_at();
CREATE TRIGGER trg_set_cafe_order_delivery_status BEFORE INSERT OR UPDATE OF order_type ON umma_qa_20261013.cafe_orders FOR EACH ROW EXECUTE FUNCTION set_cafe_order_delivery_status_on_insert();
CREATE TRIGGER trg_reserve_cafe_inventory_for_order_item BEFORE INSERT ON umma_qa_20261013.cafe_order_items FOR EACH ROW EXECUTE FUNCTION reserve_cafe_inventory_for_order_item();
CREATE TRIGGER trg_sync_cafe_order_totals BEFORE UPDATE OF subtotal_vnd, total_vnd ON umma_qa_20261013.cafe_orders FOR EACH ROW EXECUTE FUNCTION sync_cafe_order_totals();
CREATE TRIGGER trg_seed_cafe_inventory_for_location AFTER INSERT OR UPDATE OF location_type, is_active ON umma_qa_20261013.locations FOR EACH ROW EXECUTE FUNCTION seed_cafe_inventory_for_location();
CREATE TRIGGER trg_seed_cafe_inventory_for_product AFTER INSERT OR UPDATE OF product_type, is_active ON umma_qa_20261013.products FOR EACH ROW EXECUTE FUNCTION seed_cafe_inventory_for_product();
CREATE TRIGGER production_batch_item_validate BEFORE INSERT OR UPDATE OF stock_item_id, movement_direction ON umma_qa_20261013.production_batch_items FOR EACH ROW EXECUTE FUNCTION validate_production_batch_item();
CREATE TRIGGER stock_item_product_link_validate BEFORE INSERT OR UPDATE OF linked_product_id, item_type, base_unit ON umma_qa_20261013.stock_items FOR EACH ROW EXECUTE FUNCTION validate_stock_item_product_link();


-- Proposed fixes, NOT applied to the remote project.
-- Apply in a staging database first; production requires explicit owner approval.

CREATE OR REPLACE FUNCTION umma_qa_20261013.update_cafe_order_payment(p_order_id uuid, p_actor_telegram_id bigint, p_payment_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_order umma_qa_20261013.cafe_orders%rowtype;
  v_user umma_qa_20261013.telegram_users%rowtype;
  v_staff_role text;
  v_can_accept_payments boolean := false;
  v_previous text;
begin
  if p_order_id is null or p_actor_telegram_id is null then
    raise exception 'Invalid payment update request';
  end if;
  if p_payment_status not in ('paid','pending') then
    raise exception 'Invalid payment status';
  end if;

  select * into v_user from umma_qa_20261013.telegram_users
  where telegram_id = p_actor_telegram_id and is_active = true;
  if not found then raise exception 'Payment management access denied'; end if;

  select * into v_order from umma_qa_20261013.cafe_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if v_user.role = 'super_admin' then
    v_staff_role := 'manager';
    v_can_accept_payments := true;
  else
    if v_user.role not in ('admin','employee') then
      raise exception 'Payment management access denied';
    end if;
    select staff_role, can_accept_payments into v_staff_role, v_can_accept_payments
    from umma_qa_20261013.cafe_staff
    where telegram_id = p_actor_telegram_id and location_id = v_order.location_id and is_active = true;
    if not found then raise exception 'No active staff assignment for this cafe'; end if;
    if coalesce(v_can_accept_payments, false) is not true then
      raise exception 'Payment acceptance permission denied';
    end if;
  end if;

  if v_staff_role not in ('manager','cashier','waiter','kitchen','courier') then
    raise exception 'Staff role cannot update payment';
  end if;

  if v_staff_role='courier' and (v_order.order_type<>'delivery' or v_order.courier_telegram_id is distinct from p_actor_telegram_id or v_order.delivery_status not in ('picked_up','delivered')) then
    raise exception 'Courier can accept payment only for own collected delivery';
  end if;
  if v_order.status in ('completed','cancelled') then
    raise exception 'Closed order cannot receive payment changes';
  end if;
  v_previous := v_order.payment_status;
  if p_payment_status = v_previous then
    return jsonb_build_object('ok',true,'order',jsonb_build_object(
      'id',v_order.id,'orderNumber',v_order.order_number,
      'paymentStatus',v_order.payment_status,'paidAt',v_order.paid_at,
      'paidByTelegramId',v_order.paid_by_telegram_id));
  end if;
  if p_payment_status = 'pending' and v_previous = 'paid' then
    raise exception 'Use recorded refund instead of voiding payment';
  end if;


  if p_payment_status = 'paid' and v_previous <> 'paid' then
    insert into umma_qa_20261013.cafe_payment_receipts
      (order_id, location_id, collected_by_telegram_id, payment_method, amount_vnd, receipt_status, note)
    values
      (v_order.id, v_order.location_id, p_actor_telegram_id, v_order.payment_method,
       v_order.total_vnd, 'confirmed', coalesce(nullif(trim(p_note),''),'Оплата заказа подтверждена'));

  end if;

  update umma_qa_20261013.cafe_orders
  set payment_status = p_payment_status,
      paid_at = case when p_payment_status = 'paid' then coalesce(paid_at,now()) else null end,
      paid_by_telegram_id = case when p_payment_status = 'paid' then p_actor_telegram_id else null end,
      updated_at = now()
  where id = p_order_id returning * into v_order;

  -- cafe_order_events stores order lifecycle statuses, not payment statuses.
  insert into umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
  values (
    v_order.id, p_actor_telegram_id, v_order.status, v_order.status,
    concat_ws(' · ',
      coalesce(nullif(trim(p_note),''), 'Payment updated'),
      'Payment: ' || coalesce(v_previous,'unknown') || ' → ' || p_payment_status)
  );

  return jsonb_build_object(
    'ok',true,
    'order',jsonb_build_object(
      'id',v_order.id,'orderNumber',v_order.order_number,
      'paymentStatus',v_order.payment_status,'paidAt',v_order.paid_at,
      'paidByTelegramId',v_order.paid_by_telegram_id
    )
  );
end;
$function$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.update_cafe_order_payment_cash(p_order_id uuid, p_actor_telegram_id bigint, p_payment_status text, p_note text DEFAULT NULL::text, p_tendered_amount_vnd integer DEFAULT NULL::integer, p_change_given_vnd integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_order umma_qa_20261013.cafe_orders%rowtype;
  v_result jsonb;
begin
  select * into v_order from umma_qa_20261013.cafe_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if p_payment_status = 'paid' and v_order.payment_status = 'paid' then
    -- Authorize the retry and preserve the original collector/receipt.
    return umma_qa_20261013.update_cafe_order_payment(p_order_id, p_actor_telegram_id, p_payment_status, p_note);
  end if;

  if p_payment_status = 'paid' and v_order.payment_method = 'cash' then
    if p_tendered_amount_vnd is null or p_change_given_vnd is null
       or p_tendered_amount_vnd < v_order.total_vnd
       or p_change_given_vnd <> p_tendered_amount_vnd - v_order.total_vnd then
      raise exception 'Invalid cash received amount or change';
    end if;
  end if;

  v_result := umma_qa_20261013.update_cafe_order_payment(p_order_id, p_actor_telegram_id, p_payment_status, p_note);

  if p_payment_status = 'paid' and v_order.payment_method = 'cash' then
    update umma_qa_20261013.cafe_payment_receipts
       set tendered_amount_vnd = p_tendered_amount_vnd,
           change_given_vnd = p_change_given_vnd
     where id = (
       select id from umma_qa_20261013.cafe_payment_receipts
        where order_id = p_order_id
          and collected_by_telegram_id = p_actor_telegram_id
          and receipt_status = 'confirmed'
        order by collected_at desc, created_at desc
        limit 1
     );
    if not found then raise exception 'Cash receipt was not recorded'; end if;
  end if;
  return v_result;
end;
$function$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.add_cafe_staff_order_items(p_staff_telegram_id bigint, p_order_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_order umma_qa_20261013.cafe_orders%rowtype;
  v_user umma_qa_20261013.telegram_users%rowtype;
  v_staff_role text;
  v_item jsonb;
  v_product umma_qa_20261013.products%rowtype;
  v_quantity integer;
  v_added integer := 0;
  v_previous_status text;
begin
  if p_staff_telegram_id is null or p_staff_telegram_id <= 0 then raise exception 'Invalid staff'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception 'Invalid order items'; end if;
  select * into v_user from umma_qa_20261013.telegram_users where telegram_id=p_staff_telegram_id and is_active=true;
  if not found or v_user.role not in ('super_admin','admin','employee') then raise exception 'Staff access denied'; end if;
  select * into v_order from umma_qa_20261013.cafe_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_type <> 'dine_in' then raise exception 'Only dine-in bills can receive additional items'; end if;
  if v_order.payment_status = 'paid' or v_order.status in ('completed','cancelled') then raise exception 'Bill is already closed'; end if;
  if v_user.role <> 'super_admin' then
    select staff_role into v_staff_role from umma_qa_20261013.cafe_staff where telegram_id=p_staff_telegram_id and location_id=v_order.location_id and is_active=true;
    if not found or v_staff_role not in ('manager','waiter','cashier','kitchen') then raise exception 'Staff cannot add items to this bill'; end if;
  end if;
  v_previous_status := v_order.status;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item)<>'object' or not(v_item?'productId') or not(v_item?'quantity') then raise exception 'Invalid item'; end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 99 then raise exception 'Invalid item quantity'; end if;
    select * into v_product from umma_qa_20261013.products where id=(v_item->>'productId')::uuid and product_type='cafe' and is_active=true;
    if not found then raise exception 'Product not found or unavailable'; end if;
    insert into umma_qa_20261013.cafe_order_items(order_id,product_id,product_name_ru,product_name_vi,product_name_en,quantity,unit_price_vnd)
    values(v_order.id,v_product.id,v_product.name_ru,v_product.name_vi,v_product.name_en,v_quantity,v_product.price_vnd);
    v_added := v_added + 1;
  end loop;
  update umma_qa_20261013.cafe_orders
    set subtotal_vnd=(select coalesce(sum(line_total_vnd),0) from umma_qa_20261013.cafe_order_items where order_id=v_order.id),
        total_vnd=(select coalesce(sum(line_total_vnd),0) from umma_qa_20261013.cafe_order_items where order_id=v_order.id),
        status=case when status='ready' then 'preparing' else status end,
        updated_at=now()
    where id=v_order.id returning * into v_order;
  insert into umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
  values(v_order.id,p_staff_telegram_id,v_previous_status,v_order.status,'Добавлено позиций в открытый счёт: '||v_added);
  return jsonb_build_object('ok',true,'orderId',v_order.id,'orderNumber',v_order.order_number,'addedItems',v_added,'totalVnd',v_order.total_vnd,'paymentStatus',v_order.payment_status);
end;
$function$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.update_cafe_order_status(p_order_id uuid, p_actor_telegram_id bigint, p_new_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
DECLARE
  v_order umma_qa_20261013.cafe_orders%ROWTYPE;
  v_user umma_qa_20261013.telegram_users%ROWTYPE;
  v_staff_role text;
  v_previous_status text;
  v_allowed boolean:=false;
  v_item record;
  v_balance umma_qa_20261013.stock_balances%ROWTYPE;
BEGIN
  IF p_order_id IS NULL OR p_actor_telegram_id IS NULL THEN RAISE EXCEPTION 'Invalid order update request'; END IF;
  IF p_new_status NOT IN ('confirmed','preparing','ready','completed','cancelled') THEN RAISE EXCEPTION 'Invalid order status'; END IF;

  SELECT * INTO v_user FROM umma_qa_20261013.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order management access denied'; END IF;
  SELECT * INTO v_order FROM umma_qa_20261013.cafe_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_previous_status:=v_order.status;
  IF p_new_status=v_previous_status THEN RAISE EXCEPTION 'Order already has this status'; END IF;
  IF p_new_status='completed' AND v_order.payment_status<>'paid' THEN RAISE EXCEPTION 'Order cannot be completed before payment is confirmed'; END IF;
  IF p_new_status='completed' AND v_order.order_type='delivery' AND coalesce(v_order.delivery_status,'waiting_courier')<>'delivered' THEN RAISE EXCEPTION 'Delivery must be confirmed before completing the order'; END IF;

  IF v_user.role='super_admin' THEN
    v_staff_role:='manager';
  ELSE
    IF v_user.role NOT IN ('admin','employee') THEN RAISE EXCEPTION 'Order management access denied'; END IF;
    SELECT staff_role INTO v_staff_role FROM umma_qa_20261013.cafe_staff
    WHERE telegram_id=p_actor_telegram_id AND location_id=v_order.location_id AND is_active=true;
    IF NOT FOUND THEN RAISE EXCEPTION 'No active staff assignment for this cafe'; END IF;
  END IF;

  -- All assigned non-courier cafe staff share the same fulfillment permissions.
  IF v_staff_role IN ('manager','cashier','waiter','kitchen') THEN
    v_allowed:=CASE
      WHEN v_previous_status='pending' AND p_new_status IN ('confirmed','cancelled') THEN true
      WHEN v_previous_status='confirmed' AND p_new_status IN ('preparing','cancelled') THEN true
      WHEN v_previous_status='preparing' AND p_new_status IN ('ready','cancelled') THEN true
      WHEN v_previous_status='ready' AND p_new_status IN ('completed','cancelled') THEN true
      ELSE false
    END;
  END IF;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Staff role cannot perform this order status transition'; END IF;

  IF p_new_status='cancelled' AND v_order.payment_status='paid' THEN
    RAISE EXCEPTION 'Paid order requires recorded refund before cancellation';
  END IF;

  IF p_new_status='confirmed' THEN
    IF v_order.status<>'pending' OR v_order.accepted_by_telegram_id IS NOT NULL THEN RAISE EXCEPTION 'Order already accepted by another employee'; END IF;
    UPDATE umma_qa_20261013.cafe_orders SET status='confirmed',accepted_by_telegram_id=p_actor_telegram_id,accepted_at=now(),confirmed_at=now(),updated_at=now()
    WHERE id=p_order_id RETURNING * INTO v_order;
  ELSE
    UPDATE umma_qa_20261013.cafe_orders SET status=p_new_status,updated_at=now(),
      completed_at=CASE WHEN p_new_status='completed' THEN now() ELSE completed_at END,
      cancelled_at=CASE WHEN p_new_status='cancelled' THEN now() ELSE cancelled_at END
    WHERE id=p_order_id RETURNING * INTO v_order;
  END IF;

  IF p_new_status='cancelled' THEN
    IF coalesce((SELECT inventory_control_enabled FROM umma_qa_20261013.umma_runtime_settings WHERE id=true),false) THEN
    FOR v_item IN
      SELECT product_id,quantity,accounting_stock_item_id
      FROM umma_qa_20261013.cafe_order_items WHERE order_id=v_order.id AND product_id IS NOT NULL
    LOOP
      UPDATE umma_qa_20261013.inventory SET reserved_quantity=greatest(0,reserved_quantity-v_item.quantity),updated_at=now()
      WHERE product_id=v_item.product_id AND location_id=v_order.location_id;
      IF v_item.accounting_stock_item_id IS NOT NULL THEN
        UPDATE umma_qa_20261013.stock_balances SET quantity_reserved=greatest(0,quantity_reserved-v_item.quantity),updated_at=now()
        WHERE stock_item_id=v_item.accounting_stock_item_id AND location_id=v_order.location_id;
      END IF;
      INSERT INTO umma_qa_20261013.cafe_inventory_movements(location_id,product_id,order_id,actor_telegram_id,movement_type,quantity,note)
      VALUES(v_order.location_id,v_item.product_id,v_order.id,p_actor_telegram_id,'released',v_item.quantity,'Order cancelled; stock released');
    END LOOP;
    END IF;
  ELSIF p_new_status='completed' THEN
    IF coalesce((SELECT inventory_control_enabled FROM umma_qa_20261013.umma_runtime_settings WHERE id=true),false) THEN
    FOR v_item IN
      SELECT id,product_id,quantity,accounting_stock_item_id
      FROM umma_qa_20261013.cafe_order_items WHERE order_id=v_order.id AND product_id IS NOT NULL
      ORDER BY accounting_stock_item_id NULLS LAST, id
    LOOP
      UPDATE umma_qa_20261013.inventory SET quantity=greatest(0,quantity-v_item.quantity),
        reserved_quantity=greatest(0,reserved_quantity-v_item.quantity),updated_at=now()
      WHERE product_id=v_item.product_id AND location_id=v_order.location_id;

      IF v_item.accounting_stock_item_id IS NOT NULL THEN
        SELECT * INTO v_balance FROM umma_qa_20261013.stock_balances
        WHERE location_id=v_order.location_id AND stock_item_id=v_item.accounting_stock_item_id FOR UPDATE;
        IF NOT FOUND OR v_balance.quantity_on_hand < v_item.quantity OR v_balance.quantity_reserved < v_item.quantity THEN
          RAISE EXCEPTION 'Accounting stock or reservation mismatch for product %', v_item.product_id;
        END IF;
        UPDATE umma_qa_20261013.stock_balances
        SET quantity_on_hand=quantity_on_hand-v_item.quantity,
            quantity_reserved=quantity_reserved-v_item.quantity,updated_at=now()
        WHERE id=v_balance.id;

        INSERT INTO umma_qa_20261013.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id,note)
        VALUES(v_order.location_id,v_item.accounting_stock_item_id,'sale_out',-v_item.quantity,
          v_balance.average_unit_cost_vnd,'order',v_order.id,p_actor_telegram_id,'Completed order; cost of goods sold');
      END IF;

      INSERT INTO umma_qa_20261013.cafe_inventory_movements(location_id,product_id,order_id,actor_telegram_id,movement_type,quantity,note)
      VALUES(v_order.location_id,v_item.product_id,v_order.id,p_actor_telegram_id,'sold',v_item.quantity,'Order completed; stock deducted');
    END LOOP;
    END IF;
  END IF;

  INSERT INTO umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
  VALUES(v_order.id,p_actor_telegram_id,v_previous_status,p_new_status,nullif(trim(p_note),''));

  RETURN jsonb_build_object('ok',true,'order',jsonb_build_object(
    'id',v_order.id,'orderNumber',v_order.order_number,'status',v_order.status,
    'acceptedByTelegramId',v_order.accepted_by_telegram_id,'acceptedAt',v_order.accepted_at,'updatedAt',v_order.updated_at));
END;
$function$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.create_cafe_order(p_customer_telegram_id bigint, p_items jsonb, p_order_type text, p_location_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_delivery_address text DEFAULT NULL::text, p_payment_method text DEFAULT 'cash'::text, p_customer_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
  v_user umma_qa_20261013.telegram_users%rowtype;
  v_location umma_qa_20261013.locations%rowtype;
  v_order umma_qa_20261013.cafe_orders%rowtype;
  v_item jsonb;
  v_product umma_qa_20261013.products%rowtype;
  v_quantity integer;
  v_subtotal integer := 0;
  v_item_count integer := 0;
begin
  if p_location_id is null then raise exception 'Cafe location is required'; end if;

  if p_customer_telegram_id is null or p_customer_telegram_id <= 0 then
    raise exception 'Invalid customer';
  end if;

  if p_order_type not in ('pickup','delivery','dine_in') then
    raise exception 'Invalid order type';
  end if;

  if p_payment_method not in ('cash','qr','bank_transfer','card') then
    raise exception 'Invalid payment method';
  end if;

  if p_order_type = 'delivery' and nullif(trim(p_delivery_address), '') is null then
    raise exception 'Delivery address is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid order items';
  end if;

  select * into v_user
  from umma_qa_20261013.telegram_users
  where telegram_id = p_customer_telegram_id and is_active = true;

  if not found then
    raise exception 'Customer is not active or registered';
  end if;

  if p_location_id is not null then
    select * into v_location
    from umma_qa_20261013.locations
    where id = p_location_id and is_active = true
      and location_type in ('cafe','restaurant');

    if not found then
      raise exception 'Cafe location not found or inactive';
    end if;
  end if;

  insert into umma_qa_20261013.cafe_orders (
    customer_telegram_id, location_id, order_type, payment_method,
    customer_name, customer_phone, delivery_address, customer_note
  ) values (
    p_customer_telegram_id, p_location_id, p_order_type, p_payment_method,
    coalesce(nullif(trim(p_customer_name), ''), nullif(trim(concat_ws(' ', v_user.first_name, v_user.last_name)), '')),
    nullif(trim(p_customer_phone), ''),
    nullif(trim(p_delivery_address), ''),
    nullif(trim(p_customer_note), '')
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'productId')
       or not (v_item ? 'quantity') then
      raise exception 'Invalid item';
    end if;

    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'Invalid item quantity';
    end if;

    select * into v_product
    from umma_qa_20261013.products
    where id = (v_item->>'productId')::uuid
      and product_type = 'cafe'
      and is_active = true;

    if not found then
      raise exception 'Product not found or unavailable';
    end if;

    insert into umma_qa_20261013.cafe_order_items (
      order_id, product_id, product_name_ru, product_name_vi, product_name_en,
      quantity, unit_price_vnd
    ) values (
      v_order.id, v_product.id, v_product.name_ru, v_product.name_vi, v_product.name_en,
      v_quantity, v_product.price_vnd
    );

    v_subtotal := v_subtotal + (v_product.price_vnd * v_quantity);
    v_item_count := v_item_count + 1;
  end loop;

  if v_item_count < 1 then
    raise exception 'Order has no items';
  end if;

  update umma_qa_20261013.cafe_orders
  set subtotal_vnd = v_subtotal,
      total_vnd = v_subtotal,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into umma_qa_20261013.cafe_order_events (order_id, actor_telegram_id, from_status, to_status, note)
  values (v_order.id, p_customer_telegram_id, null, 'pending', 'Order created');

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'orderNumber', v_order.order_number,
      'status', v_order.status,
      'orderType', v_order.order_type,
      'subtotalVnd', v_order.subtotal_vnd,
      'totalVnd', v_order.total_vnd,
      'currency', v_order.currency,
      'createdAt', v_order.created_at
    )
  );
end;
$function$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.close_cafe_staff_shift(p_shift_id uuid, p_actor_telegram_id bigint, p_counted_cash_vnd integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013'
AS $function$
declare
  v_shift umma_qa_20261013.cafe_staff_shifts%rowtype;
  v_actor_role text;
  v_staff_role text;
  v_cash_sales integer := 0;
  v_handover_in integer := 0;
  v_handover_out integer := 0;
  v_expected integer;
begin
  if p_counted_cash_vnd is null or p_counted_cash_vnd < 0 then
    raise exception 'Фактическая сумма не может быть отрицательной';
  end if;

  select * into v_shift from umma_qa_20261013.cafe_staff_shifts where id = p_shift_id for update;
  if not found then raise exception 'Смена не найдена'; end if;
  if v_shift.shift_status <> 'open' then raise exception 'Смена уже закрыта'; end if;

  select role into v_actor_role from umma_qa_20261013.telegram_users
  where telegram_id = p_actor_telegram_id and is_active = true;
  if v_actor_role is null then raise exception 'Доступ запрещён'; end if;

  if p_actor_telegram_id <> v_shift.staff_telegram_id and v_actor_role <> 'super_admin' then
    select staff_role into v_staff_role from umma_qa_20261013.cafe_staff
    where location_id = v_shift.location_id and telegram_id = p_actor_telegram_id and is_active = true;
    if not found or v_staff_role not in ('manager','cashier') then raise exception 'Нет права закрыть чужую смену'; end if;
  end if;

  select coalesce(sum(amount_vnd),0)::integer into v_cash_sales
  from umma_qa_20261013.cafe_payment_receipts
  where location_id = v_shift.location_id
    and collected_by_telegram_id = v_shift.staff_telegram_id
    and payment_method = 'cash' and receipt_status = 'confirmed'
    and collected_at >= v_shift.opened_at and collected_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_out
  from umma_qa_20261013.cafe_cash_handovers
  where location_id = v_shift.location_id and from_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_in
  from umma_qa_20261013.cafe_cash_handovers
  where location_id = v_shift.location_id and to_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  v_expected := v_shift.opening_cash_vnd + v_cash_sales + v_handover_in - v_handover_out;

  update umma_qa_20261013.cafe_staff_shifts
  set closed_at = now(), closed_by_telegram_id = p_actor_telegram_id,
      expected_cash_vnd = v_expected, counted_cash_vnd = p_counted_cash_vnd,
      variance_vnd = p_counted_cash_vnd - v_expected,
      shift_status = 'closed', close_note = nullif(left(coalesce(p_note,''),1000),'')
  where id = p_shift_id returning * into v_shift;

  return jsonb_build_object('ok',true,'shift',to_jsonb(v_shift));
end;
$function$;

-- Proposal only. Courier acceptance, geo offers and private proof metadata.

ALTER TABLE umma_qa_20261013.cafe_orders ADD COLUMN IF NOT EXISTS dispatch_mode text NOT NULL DEFAULT 'broadcast' CHECK(dispatch_mode IN ('broadcast','nearest','manual'));
CREATE TABLE umma_qa_20261013.cafe_courier_positions(courier_telegram_id bigint PRIMARY KEY REFERENCES umma_qa_20261013.telegram_users(telegram_id),latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),accuracy_m double precision NOT NULL CHECK(accuracy_m BETWEEN 0 AND 500),updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE umma_qa_20261013.cafe_courier_offers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES umma_qa_20261013.cafe_orders(id),courier_telegram_id bigint NOT NULL REFERENCES umma_qa_20261013.telegram_users(telegram_id),status text NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','accepted','declined','expired','closed')),reason text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,responded_at timestamptz,UNIQUE(order_id,courier_telegram_id),CHECK(status<>'declined' OR length(trim(reason)) BETWEEN 3 AND 500));
CREATE INDEX cafe_courier_offers_recipient ON umma_qa_20261013.cafe_courier_offers(courier_telegram_id,status,expires_at);
CREATE TABLE umma_qa_20261013.cafe_delivery_proofs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES umma_qa_20261013.cafe_orders(id),courier_telegram_id bigint NOT NULL REFERENCES umma_qa_20261013.telegram_users(telegram_id),request_key uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('pickup','handover')),object_path text NOT NULL UNIQUE,image_sha256 text NOT NULL CHECK(image_sha256 ~ '^[a-f0-9]{64}$'),mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png')),size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 512 AND 8388608),verified_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(courier_telegram_id,request_key));
CREATE TABLE umma_qa_20261013.cafe_courier_notifications(offer_id uuid PRIMARY KEY REFERENCES umma_qa_20261013.cafe_courier_offers(id),sent_at timestamptz,attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),leased_until timestamptz,last_error text);
ALTER TABLE umma_qa_20261013.cafe_courier_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_qa_20261013.cafe_courier_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_qa_20261013.cafe_delivery_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_qa_20261013.cafe_courier_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_qa_20261013.cafe_courier_positions,umma_qa_20261013.cafe_courier_offers,umma_qa_20261013.cafe_delivery_proofs,umma_qa_20261013.cafe_courier_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON umma_qa_20261013.cafe_courier_positions,umma_qa_20261013.cafe_courier_offers,umma_qa_20261013.cafe_delivery_proofs TO service_role;

CREATE OR REPLACE FUNCTION umma_qa_20261013.is_cafe_courier_dispatch_enabled() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE enabled boolean;
BEGIN
 IF to_regclass('umma_courier_internal.worker_control') IS NULL THEN RETURN false; END IF;
 EXECUTE 'SELECT dispatch_enabled FROM umma_courier_internal.worker_control WHERE id' INTO enabled;
 RETURN coalesce(enabled,false);
END $$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.cafe_active_courier(p_actor bigint,p_location uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM umma_qa_20261013.cafe_staff s JOIN umma_qa_20261013.telegram_users u USING(telegram_id) WHERE s.telegram_id=p_actor AND s.location_id=p_location AND s.staff_role='courier' AND s.is_active AND u.is_active AND u.role IN ('employee','admin'));
$$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.ensure_cafe_courier_offers(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o umma_qa_20261013.cafe_orders%rowtype; target bigint; cafe_lat double precision;cafe_lng double precision;
BEGIN
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.order_type<>'delivery' OR o.status IN ('completed','cancelled') OR o.delivery_status<>'waiting_courier' THEN RETURN jsonb_build_object('ok',true); END IF;
 UPDATE umma_qa_20261013.cafe_courier_offers SET status='expired',responded_at=clock_timestamp() WHERE order_id=o.id AND status='offered' AND expires_at<=clock_timestamp();
 IF o.dispatch_mode IN ('nearest','manual') THEN
  IF EXISTS(SELECT 1 FROM umma_qa_20261013.cafe_courier_offers WHERE order_id=o.id AND status='offered') THEN RETURN jsonb_build_object('ok',true); END IF;
  SELECT latitude,longitude INTO cafe_lat,cafe_lng FROM umma_qa_20261013.locations WHERE id=o.location_id;
  IF cafe_lat IS NOT NULL AND cafe_lng IS NOT NULL THEN
   SELECT p.courier_telegram_id INTO target FROM umma_qa_20261013.cafe_courier_positions p
   WHERE p.updated_at>=clock_timestamp()-interval '10 minutes' AND umma_qa_20261013.cafe_active_courier(p.courier_telegram_id,o.location_id)
     AND NOT EXISTS(SELECT 1 FROM umma_qa_20261013.cafe_courier_offers f WHERE f.order_id=o.id AND f.courier_telegram_id=p.courier_telegram_id AND f.status<>'expired')
   ORDER BY (EXISTS(SELECT 1 FROM umma_qa_20261013.cafe_courier_offers f WHERE f.order_id=o.id AND f.courier_telegram_id=p.courier_telegram_id))::integer, power(sin(radians(p.latitude-cafe_lat)/2),2)+cos(radians(cafe_lat))*cos(radians(p.latitude))*power(sin(radians(p.longitude-cafe_lng)/2),2),p.courier_telegram_id LIMIT 1;
  END IF;
 END IF;
 -- Missing/stale geo falls back to all remaining active couriers; no fabricated location.
 INSERT INTO umma_qa_20261013.cafe_courier_offers(order_id,courier_telegram_id,expires_at)
 SELECT o.id,s.telegram_id,clock_timestamp()+CASE WHEN target IS NOT NULL THEN interval '2 minutes' ELSE interval '15 minutes' END
 FROM umma_qa_20261013.cafe_staff s WHERE s.location_id=o.location_id AND umma_qa_20261013.cafe_active_courier(s.telegram_id,o.location_id) AND (target IS NULL OR s.telegram_id=target)
 ON CONFLICT(order_id,courier_telegram_id) DO UPDATE SET status='offered',expires_at=excluded.expires_at,created_at=clock_timestamp(),responded_at=NULL WHERE cafe_courier_offers.status='expired';
 INSERT INTO umma_qa_20261013.cafe_courier_notifications(offer_id) SELECT id FROM umma_qa_20261013.cafe_courier_offers WHERE order_id=o.id AND status='offered' ON CONFLICT(offer_id) DO UPDATE SET sent_at=NULL,next_attempt_at=clock_timestamp() WHERE cafe_courier_notifications.sent_at IS NOT NULL AND cafe_courier_notifications.sent_at<(SELECT created_at FROM umma_qa_20261013.cafe_courier_offers WHERE id=excluded.offer_id);
 RETURN jsonb_build_object('ok',true,'nearestCourier',target);
END $$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.offer_cafe_courier(p_order_id uuid,p_actor_telegram_id bigint,p_courier_telegram_id bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o umma_qa_20261013.cafe_orders%rowtype; actor_role text; staff text; f umma_qa_20261013.cafe_courier_offers%rowtype;
BEGIN
 SELECT u.role INTO actor_role FROM umma_qa_20261013.telegram_users u WHERE telegram_id=p_actor_telegram_id AND u.is_active;
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 SELECT s.staff_role INTO staff FROM umma_qa_20261013.cafe_staff s WHERE s.telegram_id=p_actor_telegram_id AND s.location_id=o.location_id AND s.is_active;
 IF coalesce(actor_role,'')<>'super_admin' AND (coalesce(actor_role,'') NOT IN ('admin','employee') OR coalesce(staff,'') NOT IN ('manager','cashier','waiter','kitchen')) THEN RAISE EXCEPTION 'Courier dispatch access denied'; END IF;
 IF o.order_type<>'delivery' OR o.status IN ('completed','cancelled') OR o.delivery_status<>'waiting_courier' OR NOT umma_qa_20261013.cafe_active_courier(p_courier_telegram_id,o.location_id) THEN RAISE EXCEPTION 'Order cannot be offered to courier'; END IF;
 UPDATE umma_qa_20261013.cafe_orders SET dispatch_mode='manual' WHERE id=o.id RETURNING * INTO o;
 UPDATE umma_qa_20261013.cafe_courier_offers SET status='expired',expires_at=clock_timestamp(),responded_at=clock_timestamp() WHERE order_id=o.id AND courier_telegram_id<>p_courier_telegram_id AND status='offered';
 SELECT * INTO f FROM umma_qa_20261013.cafe_courier_offers WHERE order_id=o.id AND courier_telegram_id=p_courier_telegram_id;
 IF FOUND THEN
  IF f.status='declined' OR f.status='accepted' OR f.status='closed' THEN RAISE EXCEPTION 'Courier already responded to this order'; END IF;
  IF f.status='expired' OR f.expires_at<=clock_timestamp() THEN
   UPDATE umma_qa_20261013.cafe_courier_offers SET status='offered',expires_at=clock_timestamp()+interval '15 minutes',created_at=clock_timestamp(),responded_at=NULL WHERE id=f.id;
   UPDATE umma_qa_20261013.cafe_courier_notifications SET sent_at=NULL,leased_until=NULL,next_attempt_at=clock_timestamp() WHERE offer_id=f.id;
   RETURN jsonb_build_object('ok',true,'replayed',false,'order',to_jsonb(o));
  END IF;
  RETURN jsonb_build_object('ok',true,'replayed',true,'order',to_jsonb(o));
 END IF;
 INSERT INTO umma_qa_20261013.cafe_courier_offers(order_id,courier_telegram_id,expires_at) VALUES(o.id,p_courier_telegram_id,clock_timestamp()+interval '15 minutes') RETURNING * INTO f;
 INSERT INTO umma_qa_20261013.cafe_courier_notifications(offer_id) VALUES(f.id);
 RETURN jsonb_build_object('ok',true,'replayed',false,'order',to_jsonb(o));
END $$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.respond_cafe_courier_offer(p_order_id uuid,p_actor_telegram_id bigint,p_accept boolean,p_reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o umma_qa_20261013.cafe_orders%rowtype; f umma_qa_20261013.cafe_courier_offers%rowtype;
BEGIN
 IF p_accept IS NULL THEN RAISE EXCEPTION 'Courier response required'; END IF;
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR NOT umma_qa_20261013.cafe_active_courier(p_actor_telegram_id,o.location_id) THEN RAISE EXCEPTION 'Courier access denied'; END IF;
 SELECT * INTO f FROM umma_qa_20261013.cafe_courier_offers WHERE order_id=o.id AND courier_telegram_id=p_actor_telegram_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Courier offer not found'; END IF;
 IF f.status='accepted' AND p_accept AND o.courier_telegram_id=p_actor_telegram_id THEN RETURN jsonb_build_object('ok',true,'replayed',true,'order',to_jsonb(o)); END IF;
 IF f.status='declined' AND NOT p_accept AND f.reason=trim(p_reason) THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
 IF f.status<>'offered' OR f.expires_at<=clock_timestamp() OR o.status IN ('completed','cancelled') OR o.delivery_status<>'waiting_courier' THEN RAISE EXCEPTION 'Courier offer no longer available'; END IF;
 IF NOT p_accept AND length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Decline reason required'; END IF;
 UPDATE umma_qa_20261013.cafe_courier_offers SET status=CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,reason=CASE WHEN p_accept THEN NULL ELSE trim(p_reason) END,responded_at=clock_timestamp() WHERE id=f.id;
 IF p_accept THEN
  UPDATE umma_qa_20261013.cafe_orders SET courier_telegram_id=p_actor_telegram_id,delivery_status='courier_assigned',updated_at=clock_timestamp() WHERE id=o.id RETURNING * INTO o;
  UPDATE umma_qa_20261013.cafe_courier_offers SET status='closed',responded_at=clock_timestamp() WHERE order_id=o.id AND id<>f.id AND status='offered';
  INSERT INTO umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note) VALUES(o.id,p_actor_telegram_id,'waiting_courier','courier_assigned','Курьер принял предложение');
 ELSE
  PERFORM umma_qa_20261013.ensure_cafe_courier_offers(o.id);
 END IF;
 RETURN jsonb_build_object('ok',true,'replayed',false,'order',to_jsonb(o));
END $$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.update_cafe_courier_position(p_actor bigint,p_lat double precision,p_lng double precision,p_accuracy double precision) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM umma_qa_20261013.cafe_staff s WHERE s.telegram_id=p_actor AND umma_qa_20261013.cafe_active_courier(p_actor,s.location_id)) THEN RAISE EXCEPTION 'Courier access denied'; END IF;
 IF p_lat IS NULL OR p_lng IS NULL OR p_accuracy IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR p_accuracy NOT BETWEEN 0 AND 500 THEN RAISE EXCEPTION 'Invalid courier position'; END IF;
 INSERT INTO umma_qa_20261013.cafe_courier_positions VALUES(p_actor,p_lat,p_lng,p_accuracy,clock_timestamp()) ON CONFLICT(courier_telegram_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,updated_at=excluded.updated_at;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.list_cafe_courier_offers(p_actor bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('orderId',o.id,'orderNumber',o.order_number,'locationName',l.name,'totalVnd',o.total_vnd,'kitchenStatus',o.status,'expiresAt',f.expires_at)),'[]'::jsonb)
 FROM umma_qa_20261013.cafe_courier_offers f JOIN umma_qa_20261013.cafe_orders o ON o.id=f.order_id JOIN umma_qa_20261013.locations l ON l.id=o.location_id
 WHERE f.courier_telegram_id=p_actor AND f.status='offered' AND f.expires_at>clock_timestamp() AND o.delivery_status='waiting_courier' AND o.status NOT IN ('completed','cancelled') AND umma_qa_20261013.cafe_active_courier(p_actor,o.location_id);
$$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.begin_cafe_delivery_proof(p_order_id uuid,p_actor bigint,p_key uuid,p_kind text,p_sha text,p_mime text,p_size integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o umma_qa_20261013.cafe_orders%rowtype; f umma_qa_20261013.cafe_delivery_proofs%rowtype;
BEGIN
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.courier_telegram_id IS DISTINCT FROM p_actor OR NOT umma_qa_20261013.cafe_active_courier(p_actor,o.location_id) THEN RAISE EXCEPTION 'Proof courier access denied'; END IF;
 SELECT * INTO f FROM umma_qa_20261013.cafe_delivery_proofs WHERE courier_telegram_id=p_actor AND request_key=p_key;
 IF FOUND THEN
  IF f.order_id<>o.id OR f.kind<>p_kind OR f.image_sha256<>p_sha OR f.mime_type<>p_mime OR f.size_bytes<>p_size THEN RAISE EXCEPTION 'Proof key reused with different photo'; END IF;
  RETURN jsonb_build_object('ok',true,'proof',to_jsonb(f),'replayed',true);
 END IF;
 IF p_key IS NULL OR p_kind NOT IN ('pickup','handover') OR o.status IN ('completed','cancelled') OR (p_kind='pickup' AND (o.status<>'ready' OR o.delivery_status<>'courier_assigned')) OR (p_kind='handover' AND o.delivery_status<>'picked_up') THEN RAISE EXCEPTION 'Proof not allowed at this delivery stage'; END IF;
 IF p_kind='handover' AND EXISTS(SELECT 1 FROM umma_qa_20261013.cafe_delivery_proofs WHERE order_id=o.id AND courier_telegram_id=p_actor AND kind='pickup' AND verified_at IS NOT NULL AND image_sha256=p_sha) THEN RAISE EXCEPTION 'Take a new photo at handover; pickup image cannot be reused'; END IF;
 INSERT INTO umma_qa_20261013.cafe_delivery_proofs(order_id,courier_telegram_id,request_key,kind,object_path,image_sha256,mime_type,size_bytes)
 VALUES(o.id,p_actor,p_key,p_kind,o.id::text||'/'||p_actor::text||'/'||p_key::text||CASE WHEN p_mime='image/jpeg' THEN '.jpg' ELSE '.png' END,p_sha,p_mime,p_size) RETURNING * INTO f;
 RETURN jsonb_build_object('ok',true,'proof',to_jsonb(f),'replayed',false);
END $$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.confirm_cafe_delivery_proof(p_id uuid,p_actor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f umma_qa_20261013.cafe_delivery_proofs%rowtype; o umma_qa_20261013.cafe_orders%rowtype;
BEGIN
 SELECT * INTO f FROM umma_qa_20261013.cafe_delivery_proofs WHERE id=p_id AND courier_telegram_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proof not found'; END IF;
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=f.order_id FOR UPDATE;
 IF o.courier_telegram_id IS DISTINCT FROM p_actor OR NOT umma_qa_20261013.cafe_active_courier(p_actor,o.location_id) THEN RAISE EXCEPTION 'Proof courier access denied'; END IF;
 IF f.verified_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'proof',to_jsonb(f)); END IF;
 IF o.status IN ('completed','cancelled') OR (f.kind='pickup' AND (o.status<>'ready' OR o.delivery_status<>'courier_assigned')) OR (f.kind='handover' AND o.delivery_status<>'picked_up') THEN RAISE EXCEPTION 'Proof not allowed at this delivery stage'; END IF;
 UPDATE umma_qa_20261013.cafe_delivery_proofs SET verified_at=clock_timestamp() WHERE id=f.id RETURNING * INTO f;
 RETURN jsonb_build_object('ok',true,'proof',to_jsonb(f));
END $$;
-- Queue leases make concurrent notification workers safe; failed sends remain retryable.
CREATE OR REPLACE FUNCTION umma_qa_20261013.lease_cafe_courier_notifications() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE outbox jsonb;
BEGIN
 IF NOT umma_qa_20261013.is_cafe_courier_dispatch_enabled() THEN RETURN '[]'::jsonb; END IF;
 WITH selected AS (SELECT n.offer_id FROM umma_qa_20261013.cafe_courier_notifications n JOIN umma_qa_20261013.cafe_courier_offers f ON f.id=n.offer_id JOIN umma_qa_20261013.cafe_orders o ON o.id=f.order_id WHERE n.sent_at IS NULL AND n.next_attempt_at<=clock_timestamp() AND coalesce(n.leased_until,'-infinity')<clock_timestamp() AND f.status='offered' AND f.expires_at>clock_timestamp() AND o.delivery_status='waiting_courier' AND o.status NOT IN ('completed','cancelled') AND umma_qa_20261013.cafe_active_courier(f.courier_telegram_id,o.location_id) ORDER BY n.next_attempt_at LIMIT 50 FOR UPDATE OF n SKIP LOCKED), leased AS (UPDATE umma_qa_20261013.cafe_courier_notifications n SET leased_until=clock_timestamp()+interval '1 minute',attempts=attempts+1 FROM selected WHERE n.offer_id=selected.offer_id RETURNING n.offer_id)
 SELECT coalesce(jsonb_agg(jsonb_build_object('offerId',f.id,'courierId',f.courier_telegram_id,'orderNumber',o.order_number,'locationName',l.name,'ready',o.status='ready')),'[]'::jsonb) INTO outbox FROM leased JOIN umma_qa_20261013.cafe_courier_offers f ON f.id=leased.offer_id JOIN umma_qa_20261013.cafe_orders o ON o.id=f.order_id JOIN umma_qa_20261013.locations l ON l.id=o.location_id;
 RETURN outbox;
END $$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.finish_cafe_courier_notification(p_offer uuid,p_success boolean,p_error text DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 UPDATE umma_qa_20261013.cafe_courier_notifications SET sent_at=CASE WHEN p_success THEN clock_timestamp() ELSE sent_at END,leased_until=NULL,next_attempt_at=clock_timestamp()+interval '30 seconds',last_error=CASE WHEN p_success THEN NULL ELSE left(p_error,500) END WHERE offer_id=p_offer;
$$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.advance_cafe_courier_queue() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o record;
BEGIN
 FOR o IN SELECT id FROM umma_qa_20261013.cafe_orders WHERE order_type='delivery' AND delivery_status='waiting_courier' AND status NOT IN ('completed','cancelled') LOOP PERFORM umma_qa_20261013.ensure_cafe_courier_offers(o.id); END LOOP;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.authorize_cafe_delivery_proof_view(p_proof uuid,p_actor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f umma_qa_20261013.cafe_delivery_proofs%rowtype;o umma_qa_20261013.cafe_orders%rowtype;actor_role text;staff text;
BEGIN
 SELECT role INTO actor_role FROM umma_qa_20261013.telegram_users WHERE telegram_id=p_actor AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proof view access denied'; END IF;
 SELECT * INTO f FROM umma_qa_20261013.cafe_delivery_proofs WHERE id=p_proof AND verified_at IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proof not found'; END IF;
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=f.order_id;
 SELECT staff_role INTO staff FROM umma_qa_20261013.cafe_staff WHERE telegram_id=p_actor AND location_id=o.location_id AND is_active;
 IF actor_role<>'super_admin' AND NOT(coalesce(actor_role,'') IN ('admin','employee') AND (coalesce(staff,'')='manager' OR (coalesce(staff,'')='courier' AND f.courier_telegram_id=p_actor AND o.courier_telegram_id=p_actor))) THEN RAISE EXCEPTION 'Proof view access denied'; END IF;
 RETURN jsonb_build_object('ok',true,'path',f.object_path);
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='umma_qa_20261013' AND p.proname IN ('is_cafe_courier_dispatch_enabled','cafe_active_courier','ensure_cafe_courier_offers','offer_cafe_courier','respond_cafe_courier_offer','update_cafe_courier_position','list_cafe_courier_offers','begin_cafe_delivery_proof','confirm_cafe_delivery_proof','lease_cafe_courier_notifications','finish_cafe_courier_notification','advance_cafe_courier_queue','authorize_cafe_delivery_proof_view') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;

-- Per-delivery live position. No public courier directory or position history.

CREATE TABLE umma_qa_20261013.cafe_delivery_tracking(order_id uuid PRIMARY KEY REFERENCES umma_qa_20261013.cafe_orders(id),courier_telegram_id bigint NOT NULL REFERENCES umma_qa_20261013.telegram_users(telegram_id),session_id uuid NOT NULL DEFAULT gen_random_uuid(),enabled boolean NOT NULL DEFAULT false,latitude double precision,longitude double precision,accuracy_m double precision,position_at timestamptz,sequence bigint NOT NULL DEFAULT 0,CHECK(latitude BETWEEN -90 AND 90),CHECK(longitude BETWEEN -180 AND 180),CHECK(accuracy_m BETWEEN 0 AND 500));
ALTER TABLE umma_qa_20261013.cafe_delivery_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_qa_20261013.cafe_delivery_tracking FROM PUBLIC,anon,authenticated;
CREATE FUNCTION umma_qa_20261013.set_cafe_delivery_tracking(p_order uuid,p_actor bigint,p_enabled boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o umma_qa_20261013.cafe_orders%rowtype;t umma_qa_20261013.cafe_delivery_tracking%rowtype;
BEGIN
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.courier_telegram_id IS DISTINCT FROM p_actor OR NOT umma_qa_20261013.cafe_active_courier(p_actor,o.location_id) THEN RAISE EXCEPTION 'Tracking courier access denied'; END IF;
 IF p_enabled IS NULL OR (p_enabled AND (o.order_type<>'delivery' OR o.delivery_status<>'picked_up' OR o.status IN ('completed','cancelled'))) THEN RAISE EXCEPTION 'Tracking only during delivery'; END IF;
 INSERT INTO umma_qa_20261013.cafe_delivery_tracking(order_id,courier_telegram_id,enabled) VALUES(o.id,p_actor,p_enabled) ON CONFLICT(order_id) DO UPDATE SET courier_telegram_id=p_actor,enabled=p_enabled,session_id=gen_random_uuid(),latitude=NULL,longitude=NULL,accuracy_m=NULL,position_at=NULL,sequence=0 RETURNING * INTO t;
 RETURN jsonb_build_object('ok',true,'sessionId',t.session_id,'enabled',t.enabled);
END $$;
CREATE FUNCTION umma_qa_20261013.update_cafe_delivery_tracking(p_order uuid,p_actor bigint,p_session uuid,p_sequence bigint,p_lat double precision,p_lng double precision,p_accuracy double precision) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o umma_qa_20261013.cafe_orders%rowtype;t umma_qa_20261013.cafe_delivery_tracking%rowtype;
BEGIN
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.courier_telegram_id IS DISTINCT FROM p_actor OR NOT umma_qa_20261013.cafe_active_courier(p_actor,o.location_id) THEN RAISE EXCEPTION 'Tracking courier access denied'; END IF;
 IF o.order_type<>'delivery' OR o.delivery_status<>'picked_up' OR o.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Tracking only during delivery'; END IF;
 IF p_lat IS NULL OR p_lng IS NULL OR p_accuracy IS NULL OR NOT(p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180 AND p_accuracy BETWEEN 0 AND 500) OR p_sequence IS NULL OR p_sequence<=0 THEN RAISE EXCEPTION 'Invalid tracking position'; END IF;
 SELECT * INTO t FROM umma_qa_20261013.cafe_delivery_tracking WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND OR NOT t.enabled OR t.session_id IS DISTINCT FROM p_session THEN RAISE EXCEPTION 'Tracking session stopped'; END IF;
 IF p_sequence<=t.sequence THEN RETURN jsonb_build_object('ok',true,'ignored',true); END IF;
 UPDATE umma_qa_20261013.cafe_delivery_tracking SET latitude=p_lat,longitude=p_lng,accuracy_m=p_accuracy,position_at=clock_timestamp(),sequence=p_sequence WHERE order_id=p_order;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION umma_qa_20261013.get_cafe_delivery_tracking(p_order uuid,p_actor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o umma_qa_20261013.cafe_orders%rowtype;t umma_qa_20261013.cafe_delivery_tracking%rowtype;
BEGIN
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=p_order;
 IF NOT FOUND OR o.customer_telegram_id IS DISTINCT FROM p_actor OR NOT EXISTS(SELECT 1 FROM umma_qa_20261013.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'Tracking customer access denied'; END IF;
 IF o.order_type<>'delivery' THEN RETURN jsonb_build_object('ok',true,'state','unavailable'); END IF;
 IF o.delivery_status='delivered' THEN RETURN jsonb_build_object('ok',true,'state','delivered'); END IF;
 IF o.status IN ('cancelled','completed') THEN RETURN jsonb_build_object('ok',true,'state','unavailable'); END IF;
 IF o.delivery_status<>'picked_up' THEN RETURN jsonb_build_object('ok',true,'state','awaiting_pickup'); END IF;
 IF NOT umma_qa_20261013.cafe_active_courier(o.courier_telegram_id,o.location_id) THEN RETURN jsonb_build_object('ok',true,'state','unavailable'); END IF;
 SELECT * INTO t FROM umma_qa_20261013.cafe_delivery_tracking WHERE order_id=p_order AND courier_telegram_id=o.courier_telegram_id;
 IF NOT FOUND OR NOT t.enabled THEN RETURN jsonb_build_object('ok',true,'state','not_sharing'); END IF;
 IF t.position_at IS NULL OR t.position_at<clock_timestamp()-interval '60 seconds' THEN RETURN jsonb_build_object('ok',true,'state','stale','updatedAt',t.position_at); END IF;
 RETURN jsonb_build_object('ok',true,'state','live','latitude',t.latitude,'longitude',t.longitude,'accuracy',t.accuracy_m,'updatedAt',t.position_at);
END $$;
REVOKE ALL ON FUNCTION umma_qa_20261013.set_cafe_delivery_tracking(uuid,bigint,boolean),umma_qa_20261013.update_cafe_delivery_tracking(uuid,bigint,uuid,bigint,double precision,double precision,double precision),umma_qa_20261013.get_cafe_delivery_tracking(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION umma_qa_20261013.set_cafe_delivery_tracking(uuid,bigint,boolean),umma_qa_20261013.update_cafe_delivery_tracking(uuid,bigint,uuid,bigint,double precision,double precision,double precision),umma_qa_20261013.get_cafe_delivery_tracking(uuid,bigint) TO service_role;

-- Additional courier capability keeps the owner's existing staff/global roles.

ALTER TABLE umma_qa_20261013.cafe_staff ADD COLUMN IF NOT EXISTS courier_available boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION umma_qa_20261013.cafe_active_courier(p_actor bigint,p_location uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM umma_qa_20261013.cafe_staff s JOIN umma_qa_20261013.telegram_users u USING(telegram_id)
 WHERE s.telegram_id=p_actor AND s.location_id=p_location AND s.is_active AND u.is_active
 AND ((s.staff_role='courier' AND u.role IN ('employee','admin')) OR (u.role='super_admin' AND s.courier_available)));
$$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.set_cafe_self_courier(p_actor bigint,p_location uuid,p_enabled boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result umma_qa_20261013.cafe_staff%rowtype; waiting_order uuid;
BEGIN
 IF p_enabled IS NULL OR NOT EXISTS(SELECT 1 FROM umma_qa_20261013.telegram_users WHERE telegram_id=p_actor AND role='super_admin' AND is_active) THEN RAISE EXCEPTION 'Self courier access denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM umma_qa_20261013.locations WHERE id=p_location AND location_type='cafe' AND is_active) THEN RAISE EXCEPTION 'Cafe location not found'; END IF;
 IF NOT p_enabled AND EXISTS(SELECT 1 FROM umma_qa_20261013.cafe_orders WHERE location_id=p_location AND courier_telegram_id=p_actor AND order_type='delivery' AND delivery_status IN ('courier_assigned','picked_up') AND status NOT IN ('completed','cancelled')) THEN RAISE EXCEPTION 'Complete your active deliveries before going offline'; END IF;
 INSERT INTO umma_qa_20261013.cafe_staff(telegram_id,location_id,staff_role,is_active,can_accept_payments,courier_available)
 VALUES(p_actor,p_location,'courier',true,false,p_enabled)
 ON CONFLICT(telegram_id,location_id) DO UPDATE SET courier_available=excluded.courier_available,is_active=CASE WHEN excluded.courier_available THEN true ELSE cafe_staff.is_active END
 RETURNING * INTO result;
 IF p_enabled THEN
  FOR waiting_order IN SELECT id FROM umma_qa_20261013.cafe_orders WHERE location_id=p_location AND order_type='delivery' AND delivery_status='waiting_courier' AND status NOT IN ('completed','cancelled') ORDER BY id LOOP
   PERFORM umma_qa_20261013.ensure_cafe_courier_offers(waiting_order);
  END LOOP;
 END IF;
 RETURN jsonb_build_object('ok',true,'assignment',to_jsonb(result));
END $$;
REVOKE ALL ON FUNCTION umma_qa_20261013.set_cafe_self_courier(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION umma_qa_20261013.set_cafe_self_courier(bigint,uuid,boolean) TO service_role;

-- Proposed schema/API hardening. Never apply to production without owner approval.

ALTER TABLE umma_qa_20261013.cafe_orders ADD COLUMN IF NOT EXISTS payment_timing text CHECK(payment_timing IN ('now','later','on_delivery'));
CREATE SCHEMA IF NOT EXISTS umma_qa_20261013_private;
CREATE TABLE IF NOT EXISTS umma_qa_20261013_private.cafe_order_requests (
  actor_telegram_id bigint NOT NULL REFERENCES umma_qa_20261013.telegram_users(telegram_id),
  request_key uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('customerOrder','staffOrder','addItems')),
  arguments jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_telegram_id,request_key)
);
ALTER TABLE umma_qa_20261013_private.cafe_order_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA umma_qa_20261013_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON umma_qa_20261013_private.cafe_order_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION umma_qa_20261013.execute_cafe_order_operation(
  p_actor_telegram_id bigint, p_request_key uuid, p_action text, p_arguments jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE
  v_cached umma_qa_20261013_private.cafe_order_requests%rowtype;
  v_result jsonb;
  v_user umma_qa_20261013.telegram_users%rowtype;
  v_location uuid;
  v_staff_role text;
  v_payment_timing text;
BEGIN
  IF p_request_key IS NULL OR p_arguments IS NULL OR p_action IS NULL OR p_action NOT IN ('customerOrder','staffOrder','addItems') OR jsonb_typeof(p_arguments)<>'object' THEN
    RAISE EXCEPTION 'Invalid idempotent order request';
  END IF;
  SELECT * INTO v_user FROM umma_qa_20261013.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order operation access denied'; END IF;
  -- Re-check authorization even for a replay after a staff assignment is revoked.
  IF p_action IN ('staffOrder','addItems') THEN
    IF v_user.role NOT IN ('super_admin','admin','employee') THEN RAISE EXCEPTION 'Staff access denied'; END IF;
    IF p_action='staffOrder' THEN v_location:=(p_arguments->>'p_location_id')::uuid;
    ELSE SELECT location_id INTO v_location FROM umma_qa_20261013.cafe_orders WHERE id=(p_arguments->>'p_order_id')::uuid;
    END IF;
    IF v_user.role<>'super_admin' THEN
      SELECT staff_role INTO v_staff_role FROM umma_qa_20261013.cafe_staff WHERE telegram_id=p_actor_telegram_id AND location_id=v_location AND is_active=true;
      IF NOT FOUND OR v_staff_role NOT IN ('manager','cashier','waiter','kitchen') THEN RAISE EXCEPTION 'Staff operation access denied'; END IF;
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_telegram_id::text||':'||p_request_key::text,0));
  SELECT * INTO v_cached FROM umma_qa_20261013_private.cafe_order_requests WHERE actor_telegram_id=p_actor_telegram_id AND request_key=p_request_key;
  IF FOUND THEN
    IF v_cached.action<>p_action OR v_cached.arguments IS DISTINCT FROM p_arguments THEN RAISE EXCEPTION 'Idempotency key reused with different order'; END IF;
    RETURN v_cached.result || jsonb_build_object('replayed',true);
  END IF;
  IF p_action IN ('customerOrder','staffOrder') THEN
    v_payment_timing:=coalesce(p_arguments->>'p_payment_timing','now');
    IF v_payment_timing NOT IN ('now','later','on_delivery') OR (v_payment_timing='later' AND p_arguments->>'p_order_type'<>'dine_in') OR (v_payment_timing='on_delivery' AND (p_arguments->>'p_order_type'<>'delivery' OR p_arguments->>'p_payment_method'<>'cash')) THEN RAISE EXCEPTION 'Invalid payment timing for order'; END IF;
  END IF;
  IF p_action='customerOrder' THEN
    v_result:=umma_qa_20261013.create_cafe_order(p_actor_telegram_id,p_arguments->'p_items',p_arguments->>'p_order_type',
      (p_arguments->>'p_location_id')::uuid,p_arguments->>'p_customer_name',p_arguments->>'p_customer_phone',
      p_arguments->>'p_delivery_address',p_arguments->>'p_payment_method',p_arguments->>'p_customer_note');
  ELSIF p_action='staffOrder' THEN
    v_result:=umma_qa_20261013.create_cafe_staff_order(p_actor_telegram_id,(p_arguments->>'p_location_id')::uuid,
      p_arguments->'p_items',p_arguments->>'p_order_type',p_arguments->>'p_customer_name',p_arguments->>'p_customer_phone',
      p_arguments->>'p_delivery_address',p_arguments->>'p_payment_method',p_arguments->>'p_customer_note');
  ELSE
    v_result:=umma_qa_20261013.add_cafe_staff_order_items(p_actor_telegram_id,(p_arguments->>'p_order_id')::uuid,p_arguments->'p_items');
  END IF;
  IF p_action IN ('customerOrder','staffOrder') THEN
    UPDATE umma_qa_20261013.cafe_orders SET payment_timing=v_payment_timing WHERE id=(v_result->'order'->>'id')::uuid;
    v_result:=jsonb_set(v_result,'{order,paymentTiming}',to_jsonb(v_payment_timing),true);
    IF p_arguments->>'p_order_type'='delivery' THEN
      IF coalesce(p_arguments->>'p_dispatch_mode','broadcast') NOT IN ('broadcast','nearest') THEN RAISE EXCEPTION 'Invalid courier dispatch mode'; END IF;
      UPDATE umma_qa_20261013.cafe_orders SET dispatch_mode=coalesce(p_arguments->>'p_dispatch_mode','broadcast') WHERE id=(v_result->'order'->>'id')::uuid;
      PERFORM umma_qa_20261013.ensure_cafe_courier_offers((v_result->'order'->>'id')::uuid);
    END IF;
  END IF;
  INSERT INTO umma_qa_20261013_private.cafe_order_requests(actor_telegram_id,request_key,action,arguments,result)
    VALUES(p_actor_telegram_id,p_request_key,p_action,p_arguments,v_result);
  RETURN v_result || jsonb_build_object('replayed',false);
END;
$function$;
REVOKE ALL ON FUNCTION umma_qa_20261013.execute_cafe_order_operation(bigint,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION umma_qa_20261013.execute_cafe_order_operation(bigint,uuid,text,jsonb) TO service_role;

-- Server-side totals are independent of the last-100-receipts UI list.

CREATE OR REPLACE FUNCTION umma_qa_20261013.get_cafe_cash_summary(p_location_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $function$
  SELECT jsonb_build_object(
    'total24hVnd',coalesce(sum(amount_vnd),0),
    'cash24hVnd',coalesce(sum(amount_vnd) FILTER (WHERE payment_method='cash'),0),
    'pendingHandovers',(SELECT count(*) FROM umma_qa_20261013.cafe_cash_handovers WHERE location_id=p_location_id AND handover_status='pending')
  ) FROM umma_qa_20261013.cafe_payment_receipts
    WHERE location_id=p_location_id AND receipt_status='confirmed' AND collected_at>=now()-interval '24 hours' AND collected_at<=now();
$function$;
REVOKE ALL ON FUNCTION umma_qa_20261013.get_cafe_cash_summary(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION umma_qa_20261013.get_cafe_cash_summary(uuid) TO service_role;

-- Proposal: delivery transitions and assignment are atomic. Not deployed to umma_qa_20261013.

CREATE OR REPLACE FUNCTION umma_qa_20261013.update_cafe_delivery_status(p_order_id uuid, p_actor_telegram_id bigint, p_delivery_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013', 'pg_temp'
AS $function$
declare
 v_order umma_qa_20261013.cafe_orders%rowtype;
 v_user umma_qa_20261013.telegram_users%rowtype;
 v_staff_role text;
 v_previous text;
 v_allowed boolean := false;
begin
 if p_order_id is null or p_actor_telegram_id is null then raise exception 'Invalid delivery update request'; end if;
 if p_delivery_status not in ('waiting_courier','courier_assigned','picked_up','delivered') then raise exception 'Invalid delivery status'; end if;
 select * into v_user from umma_qa_20261013.telegram_users where telegram_id=p_actor_telegram_id and is_active=true;
 if not found then raise exception 'Delivery management access denied'; end if;
 select * into v_order from umma_qa_20261013.cafe_orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.order_type <> 'delivery' then raise exception 'Order is not delivery'; end if;
 if v_user.role='super_admin' then v_staff_role:='manager';
 else
   if v_user.role not in ('admin','employee') then raise exception 'Delivery management access denied'; end if;
   select staff_role into v_staff_role from umma_qa_20261013.cafe_staff where telegram_id=p_actor_telegram_id and location_id=v_order.location_id and is_active=true;
   if not found then raise exception 'No active staff assignment for this cafe'; end if;
 end if;
 if v_staff_role not in ('manager','waiter','cashier','courier') then raise exception 'Staff role cannot update delivery'; end if;
 if v_staff_role='courier' and v_order.courier_telegram_id is distinct from p_actor_telegram_id then
   raise exception 'Delivery assigned to another courier';
 end if;
 if v_order.status in ('completed','cancelled') then raise exception 'Closed order delivery cannot be changed'; end if;
 if p_delivery_status in ('courier_assigned','picked_up','delivered') and v_order.courier_telegram_id is null then raise exception 'Assign a courier first'; end if;
 if p_delivery_status='picked_up' and v_order.status<>'ready' then raise exception 'Order must be ready before pickup'; end if;

 v_previous:=v_order.delivery_status;
 if v_previous=p_delivery_status then
   return jsonb_build_object('ok',true,'replayed',true,'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'deliveryStatus',v_previous));
 end if;
 v_allowed:=case
   when v_staff_role='courier' and v_previous='courier_assigned' and p_delivery_status='picked_up' then true
   when v_staff_role='courier' and v_previous='picked_up' and p_delivery_status='delivered' then true
   when v_staff_role<>'courier' and v_previous='waiting_courier' and p_delivery_status='courier_assigned' then true
   when v_staff_role<>'courier' and v_previous='courier_assigned' and p_delivery_status='picked_up' then true
   when v_staff_role<>'courier' and v_previous='picked_up' and p_delivery_status='delivered' then true
   when v_staff_role<>'courier' and p_delivery_status='waiting_courier' and v_previous='courier_assigned' then true
   else false end;
 if not v_allowed then raise exception 'Invalid delivery status transition'; end if;
 if p_delivery_status in ('picked_up','delivered') and v_order.delivery_status<>p_delivery_status and not exists(select 1 from umma_qa_20261013.cafe_delivery_proofs where order_id=v_order.id and courier_telegram_id=v_order.courier_telegram_id and kind=case when p_delivery_status='picked_up' then 'pickup' else 'handover' end and verified_at is not null) then raise exception 'Verified delivery photo required'; end if;
 update umma_qa_20261013.cafe_orders set delivery_status=p_delivery_status,courier_telegram_id=case when p_delivery_status='waiting_courier' then null else courier_telegram_id end,updated_at=now() where id=p_order_id returning * into v_order;
 insert into umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
 values(v_order.id,p_actor_telegram_id,v_previous,p_delivery_status,coalesce(nullif(trim(p_note),''),'Статус доставки обновлён'));
 return jsonb_build_object('ok',true,'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'deliveryStatus',v_order.delivery_status));
end;
$function$;

CREATE OR REPLACE FUNCTION umma_qa_20261013.assign_cafe_courier(p_order_id uuid,p_actor_telegram_id bigint,p_courier_telegram_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'umma_qa_20261013','pg_temp' AS $$
DECLARE o umma_qa_20261013.cafe_orders%rowtype; actor_role text; staff text; previous text;
BEGIN
 SELECT role INTO actor_role FROM umma_qa_20261013.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery management access denied'; END IF;
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF actor_role<>'super_admin' THEN
  SELECT staff_role INTO staff FROM umma_qa_20261013.cafe_staff WHERE telegram_id=p_actor_telegram_id AND location_id=o.location_id AND is_active=true;
  IF NOT FOUND OR actor_role NOT IN ('admin','employee') OR staff NOT IN ('manager','cashier','waiter') THEN RAISE EXCEPTION 'Delivery management access denied'; END IF;
 END IF;
 IF o.order_type<>'delivery' OR o.status IN ('completed','cancelled') OR o.delivery_status NOT IN ('waiting_courier','courier_assigned') THEN RAISE EXCEPTION 'Order cannot be assigned to courier'; END IF;
 PERFORM 1 FROM umma_qa_20261013.cafe_staff s JOIN umma_qa_20261013.telegram_users u USING(telegram_id) WHERE s.telegram_id=p_courier_telegram_id AND s.location_id=o.location_id AND s.staff_role='courier' AND s.is_active=true AND u.is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Courier inactive or belongs to another cafe'; END IF;
 IF o.delivery_status='courier_assigned' AND o.courier_telegram_id=p_courier_telegram_id THEN RETURN jsonb_build_object('ok',true,'replayed',true,'order',to_jsonb(o)); END IF;
 previous:=o.delivery_status;
 UPDATE umma_qa_20261013.cafe_orders SET courier_telegram_id=p_courier_telegram_id,delivery_status='courier_assigned',updated_at=now() WHERE id=o.id RETURNING * INTO o;
 INSERT INTO umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note) VALUES(o.id,p_actor_telegram_id,previous,'courier_assigned','Курьер назначен');
 RETURN jsonb_build_object('ok',true,'replayed',false,'order',to_jsonb(o));
END $$;
REVOKE ALL ON FUNCTION umma_qa_20261013.assign_cafe_courier(uuid,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION umma_qa_20261013.assign_cafe_courier(uuid,bigint,bigint) TO service_role;
REVOKE ALL ON FUNCTION umma_qa_20261013.update_cafe_delivery_status(uuid,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION umma_qa_20261013.update_cafe_delivery_status(uuid,bigint,text,text) TO service_role;


-- Full refunds only: immutable receipts, explicit manual payout acknowledgement, no external transfer.

CREATE TABLE umma_qa_20261013.cafe_order_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL UNIQUE REFERENCES umma_qa_20261013.cafe_orders(id),
 receipt_id uuid NOT NULL UNIQUE REFERENCES umma_qa_20261013.cafe_payment_receipts(id),
 location_id uuid NOT NULL REFERENCES umma_qa_20261013.locations(id),
 actor_telegram_id bigint NOT NULL REFERENCES umma_qa_20261013.telegram_users(telegram_id),
 request_key uuid NOT NULL,
 amount_vnd integer NOT NULL CHECK(amount_vnd>0),
 payment_method text NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 500),
 cash_shift_id uuid REFERENCES umma_qa_20261013.cafe_staff_shifts(id),
 refunded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor_telegram_id,request_key),
 CHECK((payment_method='cash')=(cash_shift_id IS NOT NULL))
);
CREATE INDEX cafe_refunds_location_time ON umma_qa_20261013.cafe_order_refunds(location_id,refunded_at);
ALTER TABLE umma_qa_20261013.cafe_order_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_qa_20261013.cafe_order_refunds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON umma_qa_20261013.cafe_order_refunds TO service_role;
CREATE OR REPLACE FUNCTION umma_qa_20261013.refund_cafe_order(p_order_id uuid,p_actor_telegram_id bigint,p_request_key uuid,p_reason text,p_payout_confirmed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o umma_qa_20261013.cafe_orders%rowtype; r umma_qa_20261013.cafe_payment_receipts%rowtype; f umma_qa_20261013.cafe_order_refunds%rowtype;
 actor_role text; staff text; shift umma_qa_20261013.cafe_staff_shifts%rowtype; available bigint; receipt_count int;
BEGIN
 IF p_request_key IS NULL OR p_payout_confirmed IS DISTINCT FROM true OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Refund requires reason and confirmation of actual payout'; END IF;
 SELECT role INTO actor_role FROM umma_qa_20261013.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cafe-refund:'||p_actor_telegram_id::text||':'||p_request_key::text,0));
 SELECT * INTO o FROM umma_qa_20261013.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF actor_role<>'super_admin' THEN
  SELECT staff_role INTO staff FROM umma_qa_20261013.cafe_staff WHERE telegram_id=p_actor_telegram_id AND location_id=o.location_id AND is_active=true;
  IF NOT FOUND OR actor_role NOT IN ('admin','employee') OR staff<>'manager' THEN RAISE EXCEPTION 'Refund access denied'; END IF;
 END IF;
 SELECT * INTO f FROM umma_qa_20261013.cafe_order_refunds WHERE actor_telegram_id=p_actor_telegram_id AND request_key=p_request_key;
 IF FOUND THEN
  IF f.order_id<>p_order_id OR f.reason<>trim(p_reason) THEN RAISE EXCEPTION 'Refund key reused with different payload'; END IF;
  RETURN jsonb_build_object('ok',true,'replayed',true,'refund',to_jsonb(f));
 END IF;
 IF o.payment_status<>'paid' THEN RAISE EXCEPTION 'Order has no refundable payment'; END IF;
 SELECT count(*) INTO receipt_count FROM umma_qa_20261013.cafe_payment_receipts WHERE order_id=o.id AND receipt_status='confirmed';
 SELECT * INTO r FROM umma_qa_20261013.cafe_payment_receipts WHERE order_id=o.id AND receipt_status='confirmed';
 IF receipt_count<>1 OR r.amount_vnd<>o.total_vnd THEN RAISE EXCEPTION 'Receipt reconciliation required before refund'; END IF;
 IF r.payment_method='cash' THEN
  SELECT * INTO shift FROM umma_qa_20261013.cafe_staff_shifts WHERE location_id=o.location_id AND staff_telegram_id=p_actor_telegram_id AND shift_status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open your cash shift before refund'; END IF;
  SELECT shift.opening_cash_vnd
   +coalesce((SELECT sum(amount_vnd) FROM umma_qa_20261013.cafe_payment_receipts WHERE location_id=o.location_id AND collected_by_telegram_id=p_actor_telegram_id AND payment_method='cash' AND receipt_status='confirmed' AND collected_at>=shift.opened_at),0)
   +coalesce((SELECT sum(amount_vnd) FROM umma_qa_20261013.cafe_cash_handovers WHERE location_id=o.location_id AND to_telegram_id=p_actor_telegram_id AND handover_status='accepted' AND accepted_at>=shift.opened_at),0)
   -coalesce((SELECT sum(amount_vnd) FROM umma_qa_20261013.cafe_cash_handovers WHERE location_id=o.location_id AND from_telegram_id=p_actor_telegram_id AND handover_status='accepted' AND accepted_at>=shift.opened_at),0)
   -coalesce((SELECT sum(amount_vnd) FROM umma_qa_20261013.cafe_order_refunds WHERE cash_shift_id=shift.id),0) INTO available;
  IF available<r.amount_vnd THEN RAISE EXCEPTION 'Insufficient recorded cash for refund'; END IF;
 END IF;
 INSERT INTO umma_qa_20261013.cafe_order_refunds(order_id,receipt_id,location_id,actor_telegram_id,request_key,amount_vnd,payment_method,reason,cash_shift_id)
 VALUES(o.id,r.id,o.location_id,p_actor_telegram_id,p_request_key,r.amount_vnd,r.payment_method,trim(p_reason),shift.id) RETURNING * INTO f;
 UPDATE umma_qa_20261013.cafe_orders SET payment_status='refunded',status='cancelled',updated_at=clock_timestamp() WHERE id=o.id;
 INSERT INTO umma_qa_20261013.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
 VALUES(o.id,p_actor_telegram_id,o.status,'cancelled','Полный возврат: '||trim(p_reason));
 RETURN jsonb_build_object('ok',true,'replayed',false,'refund',to_jsonb(f));
END $$;
REVOKE ALL ON FUNCTION umma_qa_20261013.refund_cafe_order(uuid,bigint,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION umma_qa_20261013.refund_cafe_order(uuid,bigint,uuid,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION umma_qa_20261013.close_cafe_staff_shift(p_shift_id uuid, p_actor_telegram_id bigint, p_counted_cash_vnd integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'umma_qa_20261013'
AS $function$
declare
  v_shift umma_qa_20261013.cafe_staff_shifts%rowtype;
  v_actor_role text;
  v_staff_role text;
  v_cash_sales integer := 0;
  v_handover_in integer := 0;
  v_handover_out integer := 0;
  v_expected integer;
  v_cash_refunds integer := 0;
begin
  if p_counted_cash_vnd is null or p_counted_cash_vnd < 0 then
    raise exception 'Фактическая сумма не может быть отрицательной';
  end if;

  select * into v_shift from umma_qa_20261013.cafe_staff_shifts where id = p_shift_id for update;
  if not found then raise exception 'Смена не найдена'; end if;
  if v_shift.shift_status <> 'open' then raise exception 'Смена уже закрыта'; end if;

  select role into v_actor_role from umma_qa_20261013.telegram_users
  where telegram_id = p_actor_telegram_id and is_active = true;
  if v_actor_role is null then raise exception 'Доступ запрещён'; end if;

  if p_actor_telegram_id <> v_shift.staff_telegram_id and v_actor_role <> 'super_admin' then
    select staff_role into v_staff_role from umma_qa_20261013.cafe_staff
    where location_id = v_shift.location_id and telegram_id = p_actor_telegram_id and is_active = true;
    if not found or v_staff_role not in ('manager','cashier') then raise exception 'Нет права закрыть чужую смену'; end if;
  end if;

  select coalesce(sum(amount_vnd),0)::integer into v_cash_sales
  from umma_qa_20261013.cafe_payment_receipts
  where location_id = v_shift.location_id
    and collected_by_telegram_id = v_shift.staff_telegram_id
    and payment_method = 'cash' and receipt_status = 'confirmed'
    and collected_at >= v_shift.opened_at and collected_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_out
  from umma_qa_20261013.cafe_cash_handovers
  where location_id = v_shift.location_id and from_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_in
  from umma_qa_20261013.cafe_cash_handovers
  where location_id = v_shift.location_id and to_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  SELECT coalesce(sum(amount_vnd),0)::integer INTO v_cash_refunds FROM umma_qa_20261013.cafe_order_refunds
   WHERE cash_shift_id=v_shift.id AND refunded_at<=clock_timestamp();
  v_expected := v_shift.opening_cash_vnd + v_cash_sales + v_handover_in - v_handover_out - v_cash_refunds;

  update umma_qa_20261013.cafe_staff_shifts
  set closed_at = now(), closed_by_telegram_id = p_actor_telegram_id,
      expected_cash_vnd = v_expected, counted_cash_vnd = p_counted_cash_vnd,
      variance_vnd = p_counted_cash_vnd - v_expected,
      shift_status = 'closed', close_note = nullif(left(coalesce(p_note,''),1000),'')
  where id = p_shift_id returning * into v_shift;

  return jsonb_build_object('ok',true,'shift',to_jsonb(v_shift));
end;
$function$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.get_cafe_cash_summary(p_location_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
WITH payments AS (SELECT coalesce(sum(amount_vnd),0) total,coalesce(sum(amount_vnd) FILTER(WHERE payment_method='cash'),0) cash FROM umma_qa_20261013.cafe_payment_receipts WHERE location_id=p_location_id AND receipt_status='confirmed' AND collected_at>=now()-interval '24 hours' AND collected_at<=now()),
refunds AS (SELECT coalesce(sum(amount_vnd),0) total,coalesce(sum(amount_vnd) FILTER(WHERE payment_method='cash'),0) cash FROM umma_qa_20261013.cafe_order_refunds WHERE location_id=p_location_id AND refunded_at>=now()-interval '24 hours' AND refunded_at<=now())
SELECT jsonb_build_object('total24hVnd',payments.total-refunds.total,'cash24hVnd',payments.cash-refunds.cash,'gross24hVnd',payments.total,'refund24hVnd',refunds.total,'pendingHandovers',(SELECT count(*) FROM umma_qa_20261013.cafe_cash_handovers WHERE location_id=p_location_id AND handover_status='pending')) FROM payments,refunds;
$$;

INSERT INTO umma_qa_20261013.telegram_users(telegram_id,role) VALUES
 (10,'super_admin'),(11,'employee'),(12,'employee'),(13,'employee'),(14,'employee'),(15,'user'),(16,'employee'),(17,'employee'),(18,'employee');
INSERT INTO umma_qa_20261013.locations(id,name,location_type) VALUES
 ('11111111-1111-4111-8111-111111111111','Synthetic QA cafe','cafe'),
 ('22222222-2222-4222-8222-222222222222','Other synthetic QA cafe','cafe');
INSERT INTO umma_qa_20261013.products(id,name_ru,name_vi,name_en,product_type,price_vnd) VALUES
 ('33333333-3333-4333-8333-333333333333','QA dish','QA dish','QA dish','cafe',120000);
INSERT INTO umma_qa_20261013.cafe_staff(telegram_id,location_id,staff_role,can_accept_payments)
 VALUES (11,'11111111-1111-4111-8111-111111111111','waiter',false),
 (12,'11111111-1111-4111-8111-111111111111','kitchen',false),
 (13,'11111111-1111-4111-8111-111111111111','cashier',true),
 (14,'11111111-1111-4111-8111-111111111111','cashier',true),
 (16,'11111111-1111-4111-8111-111111111111','manager',true),
 (18,'11111111-1111-4111-8111-111111111111','waiter',false),
 (17,'22222222-2222-4222-8222-222222222222','waiter',false);
INSERT INTO umma_qa_20261013.umma_runtime_settings(id,inventory_control_enabled) VALUES(true,false);
CREATE TABLE umma_qa_20261013.qa_runs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 case_name text NOT NULL,worker text NOT NULL,backend_pid integer NOT NULL,
 started_at timestamptz NOT NULL,finished_at timestamptz NOT NULL,
 ok boolean NOT NULL,result jsonb,error_message text,error_code text
);
CREATE OR REPLACE FUNCTION umma_qa_20261013.qa_worker(p_case text,p_worker text,p_hold_seconds integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=umma_qa_20261013,pg_catalog AS $$
DECLARE
 v_started timestamptz:=clock_timestamp();v_pid integer:=pg_backend_pid();
 v_result jsonb;v_error text;v_code text;v_ok boolean:=true;
 v_cafe uuid:='11111111-1111-4111-8111-111111111111';
 v_product uuid:='33333333-3333-4333-8333-333333333333';
 v_items jsonb:=jsonb_build_array(jsonb_build_object('productId',v_product,'quantity',1));
 v_actor bigint:=CASE WHEN p_worker='A' THEN 11 ELSE 18 END;
 v_order uuid;
BEGIN
 IF p_worker='A' THEN PERFORM pg_advisory_xact_lock(hashtextextended('umma_qa:'||p_case||':A',0)); END IF;
 IF p_worker NOT IN ('A','B') OR p_hold_seconds NOT BETWEEN 0 AND 3 THEN RAISE EXCEPTION 'Invalid QA worker'; END IF;
 IF p_worker='B' THEN PERFORM pg_sleep(1); END IF;
 BEGIN
  IF p_case='same_request' THEN
   v_result:=umma_qa_20261013.execute_cafe_order_operation(11,'44444444-4444-4444-8444-444444444445','staffOrder',
    jsonb_build_object('p_location_id',v_cafe,'p_items',v_items,'p_order_type','pickup','p_customer_name','QA replay','p_payment_method','cash'));
  ELSIF p_case='same_table' THEN
   v_result:=umma_qa_20261013.execute_cafe_order_operation(v_actor,
    CASE WHEN p_worker='A' THEN '55555555-5555-4555-8555-555555555556'::uuid ELSE '66666666-6666-4666-8666-666666666667'::uuid END,
    'staffOrder',jsonb_build_object('p_location_id',v_cafe,'p_items',v_items,'p_order_type','dine_in','p_customer_name','Стол №1','p_payment_method','cash'));
  ELSE
   SELECT id INTO STRICT v_order FROM umma_qa_20261013.cafe_orders WHERE customer_name='QA '||p_case;
   IF p_case='same_addon' THEN
    v_result:=umma_qa_20261013.execute_cafe_order_operation(11,'77777777-7777-4777-8777-777777777777','addItems',jsonb_build_object('p_order_id',v_order,'p_items',v_items));
   ELSIF p_case='same_payment' THEN
    v_result:=umma_qa_20261013.update_cafe_order_payment_cash(v_order,CASE WHEN p_worker='A' THEN 13 ELSE 14 END,'paid',NULL,150000,30000);
   ELSIF p_case='add_then_pay' THEN
    IF p_worker='A' THEN v_result:=umma_qa_20261013.add_cafe_staff_order_items(11,v_order,v_items);
    ELSE v_result:=umma_qa_20261013.update_cafe_order_payment_cash(v_order,13,'paid',NULL,150000,30000);END IF;
   ELSIF p_case='pay_then_add' THEN
    IF p_worker='A' THEN v_result:=umma_qa_20261013.update_cafe_order_payment_cash(v_order,13,'paid',NULL,150000,30000);
    ELSE v_result:=umma_qa_20261013.add_cafe_staff_order_items(11,v_order,v_items);END IF;
   ELSIF p_case='same_accept' THEN
    v_result:=umma_qa_20261013.update_cafe_order_status(v_order,v_actor,'confirmed');
   ELSE RAISE EXCEPTION 'Unknown QA case';END IF;
  END IF;
  PERFORM pg_sleep(p_hold_seconds);
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT,v_code=RETURNED_SQLSTATE;v_ok:=false;
 END;
 INSERT INTO umma_qa_20261013.qa_runs(case_name,worker,backend_pid,started_at,finished_at,ok,result,error_message,error_code)
 VALUES(p_case,p_worker,v_pid,v_started,clock_timestamp(),v_ok,v_result,v_error,v_code);
 RETURN jsonb_build_object('ok',v_ok,'result',v_result,'error',v_error,'code',v_code,'pid',v_pid);
END $$;
DO $$ DECLARE v_case text;BEGIN
 FOREACH v_case IN ARRAY ARRAY['same_addon','same_payment','add_then_pay','pay_then_add','same_accept'] LOOP
  PERFORM umma_qa_20261013.create_cafe_staff_order(11,'11111111-1111-4111-8111-111111111111',
   '[{"productId":"33333333-3333-4333-8333-333333333333","quantity":1}]','dine_in','QA '||v_case);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION umma_qa_20261013.qa_worker_a_running(p_case text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=umma_qa_20261013,pg_catalog AS $$
 SELECT NOT pg_try_advisory_xact_lock(hashtextextended('umma_qa:'||p_case||':A',0));
$$;
-- New schemas are not exposed through the application API. Deny all app roles explicitly.
REVOKE ALL ON SCHEMA umma_qa_20261013,umma_qa_20261013_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA umma_qa_20261013,umma_qa_20261013_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA umma_qa_20261013,umma_qa_20261013_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA umma_qa_20261013,umma_qa_20261013_private FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('umma_qa_20261013','umma_qa_20261013_private') LOOP
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.schemaname,t.tablename);
 END LOOP;
END $$;
COMMIT;
