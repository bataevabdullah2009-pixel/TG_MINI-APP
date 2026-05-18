# NOTIFICATION SPEC

Сервис: `src/lib/notifications/notification-service.ts`.

Методы:
- `notifyBusinessOwnerNewOrder(orderId)`;
- `notifyBusinessOwnerNewBooking(bookingId)`;
- `notifyCustomerOrderStatus(customerId, orderId)`;
- `notifyCustomerBookingStatus(customerId, bookingId)`.

Уведомления отправляются общим ботом SmartBiz AI, но текст оформлен от имени магазина. Если нужен отдельный отправитель, нужен отдельный bot token на бизнес и тариф BUSINESS.
