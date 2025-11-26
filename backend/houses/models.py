from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid

class User(AbstractUser):
    ROLE_CHOICES = (
        ('tenant', 'Tenant'),
        ('landlord', 'Landlord'),
        ('admin', 'Admin'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='tenant')
    is_banned = models.BooleanField(default=False, help_text="Whether the user account is banned")
    is_online = models.BooleanField(default=False, help_text="Whether the user is currently online")
    last_seen = models.DateTimeField(auto_now=True, help_text="Last time the user was active")

    def __str__(self):
        return f"{self.username} ({self.role})"

class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    house = models.ForeignKey('House', on_delete=models.CASCADE, related_name='messages')
    text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"Message from {self.sender.username} to {self.receiver.username} about {self.house.title}"

class Payment(models.Model):
    PAYMENT_STATUS = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    # Unique transaction identifiers
    transaction_id = models.CharField(max_length=50, blank=True)
    merchant_request_id = models.CharField(max_length=50, blank=True)
    checkout_request_id = models.CharField(max_length=50, blank=True)

    # Payment details
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    phone_number = models.CharField(max_length=15)  # Format: 254XXXXXXXXX
    account_reference = models.CharField(max_length=100)  # Internal reference
    transaction_desc = models.CharField(max_length=255)

    # Status and response
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='pending')
    mpesa_receipt_number = models.CharField(max_length=50, blank=True)
    result_desc = models.TextField(blank=True)

    # Relations
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments', null=True, blank=True)
    house = models.ForeignKey('House', on_delete=models.CASCADE, related_name='payments', null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payment {self.transaction_id} - {self.amount} KES - {self.status}"

    class Meta:
        ordering = ['-created_at']

class House(models.Model):
    APPROVAL_STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    # Basic house information (from React form)
    title = models.CharField(max_length=200)
    description = models.TextField()
    location = models.CharField(max_length=200)
    
    # Pricing information (from React form)
    monthly_rent = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Property specs (from React form)
    size = models.CharField(max_length=100, blank=True)
    
    # Images (store image URLs from React)
    images = models.JSONField(default=list)
    
    # Amenities (store amenity IDs from React)
    amenities = models.JSONField(default=list)
    
    # 🎯 MAKE LANDLORD OPTIONAL TEMPORARILY
    landlord = models.ForeignKey('User', on_delete=models.CASCADE, null=True, blank=True)
    landlord_name = models.CharField(max_length=100, default='Landlord')
    # Firebase identity for landlord scoping
    landlord_uid = models.CharField(max_length=128, blank=True, default='')
    landlord_email = models.EmailField(blank=True)
    
    # Status fields
    is_vacant = models.BooleanField(default=True)
    approval_status = models.CharField(
        max_length=20, 
        choices=APPROVAL_STATUS, 
        default='pending'
    )
    # Reason why a house is pending (e.g., edited fields or vacancy change)
    pending_reason = models.TextField(blank=True, default='')
    
    # Availability (from React form)
    available_date = models.DateField(null=True, blank=True)
    
    # Contact info (from React form)
    contact_phone = models.CharField(max_length=15, blank=True)
    contact_email = models.EmailField(blank=True)
    exact_location = models.CharField(max_length=300, blank=True)

    # View tracking
    view_count = models.PositiveIntegerField(default=0, help_text="Number of times this house has been viewed by tenants")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.title} - {self.location}"

    class Meta:
        ordering = ['-created_at']