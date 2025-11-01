from django.urls import path
from . import views

urlpatterns = [
    path('houses/', views.HouseListCreateView.as_view(), name='house-list'),
    path('houses/<int:pk>/', views.HouseDetailView.as_view(), name='house-detail'),
    path('my-houses/', views.LandlordHousesView.as_view(), name='landlord-houses'),
    path('admin/pending-houses/', views.PendingHousesView.as_view(), name='pending-houses'),
    path('admin/approve-house/<int:house_id>/', views.approve_house, name='approve-house'),
    path('admin/reject-house/<int:house_id>/', views.reject_house, name='reject-house'),
]