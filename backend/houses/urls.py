from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('houses/', views.HouseListCreateView.as_view(), name='house-list'),
    path('houses/<int:pk>/', views.HouseDetailView.as_view(), name='house-detail'),
    path('my-houses/', views.LandlordHousesView.as_view(), name='landlord-houses'),
    path('admin/pending-houses/', views.PendingHousesView.as_view(), name='pending-houses'),
    path('admin/rejected-houses/', views.RejectedHousesView.as_view(), name='rejected-houses'),
    path('admin/approve-house/<int:house_id>/', views.approve_house, name='approve-house'),
    path('admin/reject-house/<int:house_id>/', views.reject_house, name='reject-house'),

    # Authentication endpoints
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/user/', views.get_user, name='get_user'),

    # Admin endpoints
    path('admin/users/', views.get_users, name='get_users'),
    path('admin/ban-user/<int:user_id>/', views.ban_user, name='ban_user'),
    path('admin/unban-user/<int:user_id>/', views.unban_user, name='unban_user'),
    path('admin/delete-user/<int:user_id>/', views.delete_user, name='delete_user'),

    # User self-management endpoints
    path('auth/delete-account/', views.delete_own_account, name='delete_own_account'),

    # Admin endpoints
    path('admin/change-house-status/<int:house_id>/', views.change_house_status, name='change_house_status'),

    # Message endpoints
    path('messages/', views.MessageListCreateView.as_view(), name='message-list'),
    path('messages/<int:pk>/', views.MessageDetailView.as_view(), name='message-detail'),
    path('houses/<int:house_id>/messages/', views.get_house_messages, name='house-messages'),
    path('houses/<int:house_id>/messages/mark-read/', views.mark_messages_read, name='mark-messages-read'),
    path('conversations/delete/', views.delete_conversation, name='delete-conversation'),

    # Payment endpoints
    path('payments/initiate/', views.initiate_payment, name='initiate-payment'),
    path('mpesa-express-simulate/', views.mpesa_callback, name='mpesa-callback'),
    path('payments/simulate-success/', views.simulate_payment_success, name='simulate-payment'),
    path('payments/', views.get_user_payments, name='user-payments'),
    path('payments/test-config/', views.test_mpesa_config, name='test-mpesa-config'),

    # Favorites endpoints
    path('favorites/valid/', views.get_valid_favorites, name='valid-favorites'),
]