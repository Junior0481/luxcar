import { supabase, type Payment } from '../lib/supabase';

/** Atualiza o pagamento e deixa o banco decidir se o total já finaliza a venda. */
export function setPaymentStatus(paymentId: string, nextStatus: Payment['status']) {
  return supabase.rpc('set_payment_status', {
    payment_id: paymentId,
    next_status: nextStatus,
  });
}

/** Finaliza a venda de forma atômica pelo RPC do banco. */
export function finalizeSale(negotiationId: string) {
  return supabase.rpc('finalize_sale', { target_negotiation: negotiationId });
}
