export function submitCafeOperation(client: any, actor: number, requestKey: unknown, action: string, args: unknown) {
  if (typeof requestKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
    return Promise.resolve({data:null,error:{message:'Invalid idempotent order request'}});
  }
  return client.rpc('execute_cafe_order_operation', {
    p_actor_telegram_id: actor, p_request_key: requestKey, p_action: action, p_arguments: args,
  });
}
