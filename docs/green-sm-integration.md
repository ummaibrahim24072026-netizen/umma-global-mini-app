# Green SM Express for HALAL UMMA web orders

The web workflow uses the original Green SM SQL proposal and the `cafe_green_sm_fulfillment` migration. The migration adds verified staff actions and customer tracking fields.

Customers select their address and pin, provide a phone number, and pay for food by QR. New guest web delivery orders have a zero delivery fee and manual dispatch, so they are excluded from UMMA courier offers. The map stays in checkout. The client follows the delivery in the order progress card in Messages.

Once payment is confirmed and the order is ready, staff use **Вызвать Green SM** and the copy controls for pickup, destination, coordinates and recipient phone. In Green SM choose **Giao hàng**, select cash (Tiền mặt), set the sender (Người gửi) as the payer, and pay the courier at pickup. Book without collecting money from the recipient. Opening the app leaves the order unchanged. Confirm each actual event in order: booking, assignment, arrival, pickup, then delivery. Pickup keeps the order open. Confirming delivery closes it. If Green SM provides a tracking link, save it under **Номер и ссылка доставки** and it will appear in the customer’s existing Messages progress card.

The launcher URL is the official app link from the [Green SM download page](https://www.greensm.com/vn-vi/download). The public [Express instructions](https://www.greensm.com/vn-vi/green-express) describe manual entry of both stops. Address prefill requires a supported booking link or documented partner integration from Green SM.
