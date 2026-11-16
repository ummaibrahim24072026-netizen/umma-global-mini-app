# Green SM Express for HALAL UMMA web orders

Deploy `supabase/proposals/cafe-web-green-sm.sql` after the existing cafe payment, dispatch and preorder SQL, together with the standalone web menu and staff pages.

Customers select their address and pin, provide a phone number, and pay for food by QR. New guest web delivery orders have a zero delivery fee and manual dispatch, so they are excluded from UMMA courier offers. The map stays in checkout. The client follows order status in the receipt.

Once payment is confirmed and the order is ready, staff use **Открыть Green SM** and the copy controls for pickup, destination, coordinates and recipient phone. In Green SM choose **Giao hàng**, select cash (Tiền mặt), set the sender (Người gửi) as the payer, and pay the courier at pickup. Book without collecting money from the recipient. Staff close the order after confirming delivery in Green SM. Opening the link does not update order status or create a booking.

The launcher URL is the official app link from the [Green SM download page](https://www.greensm.com/vn-vi/download). The public [Express instructions](https://www.greensm.com/vn-vi/green-express) describe manual entry of both stops. Address prefill requires a supported booking link or documented partner integration from Green SM.
