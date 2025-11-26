from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<house_id>\d+)/$', consumers.ChatConsumer.as_asgi()),
    re_path(r'ws/favorites-cleanup/$', consumers.FavoritesCleanupConsumer.as_asgi()),
    re_path(r'ws/payments/(?P<payment_id>\d+)/$', consumers.PaymentStatusConsumer.as_asgi()),
    re_path(r'ws/payment-completions/$', consumers.PaymentCompletionConsumer.as_asgi()),
]