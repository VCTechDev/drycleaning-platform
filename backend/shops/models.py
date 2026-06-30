from django.db import models
from users.models import User

# Create your models here.

class Shop(models.Model):

    DISTRICT_CHOICES = (
        ('Thiruvananthapuram', 'Thiruvananthapuram'),
        ('Kollam', 'Kollam'),
        ('Pathanamthitta', 'Pathanamthitta'),
        ('Alappuzha', 'Alappuzha'),
        ('Kottayam', 'Kottayam'),
        ('Idukki', 'Idukki'),
        ('Ernakulam', 'Ernakulam'),
        ('Thrissur', 'Thrissur'),
        ('Palakkad', 'Palakkad'),
        ('Malappuram', 'Malappuram'),
        ('Kozhikode', 'Kozhikode'),
        ('Wayanad', 'Wayanad'),
        ('Kannur', 'Kannur'),
        ('Kasaragod', 'Kasaragod'),
    )

    STATE_CHOICES=(
        ('Kerala','Kerala'),
    )

    shop_admin = models.OneToOneField(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='shop')
    shop_name= models.CharField(max_length=50)
    description = models.TextField(blank=True)
    image=models.ImageField(upload_to='shops/',blank=True ,null=True)
    contact_number=models.CharField(max_length=15)

    address_line=models.CharField(max_length=255)
    city=models.CharField(max_length=50)
    district=models.CharField(max_length=30,choices=DISTRICT_CHOICES)
    state=models.CharField(max_length=20,choices=STATE_CHOICES)
    pincode=models.CharField(max_length=10)

    opening_time=models.TimeField()
    closing_time=models.TimeField()

    is_approved=models.BooleanField(default=False)
    is_open=models.BooleanField(default=False)

    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.shop_name
    


class Service(models.Model):

    service_name=models.CharField(max_length=50,unique=True)
    description=models.TextField(max_length=255,blank=True)
    image=models.ImageField(upload_to='services/',blank=True,null=True)
    is_active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.service_name
    
    
class GarmentType(models.Model):

    garment_name=models.CharField(max_length=50,unique=True)
    description=models.CharField(max_length=100,blank=True)
    image=models.ImageField(upload_to='garments/',null=True,blank=True)
    is_active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.garment_name
    
    
class ShopService(models.Model):
    shop=models.ForeignKey(Shop,on_delete=models.PROTECT,related_name="shop_services")
    service=models.ForeignKey(Service,on_delete=models.PROTECT,related_name="shop_services")
    garment_type=models.ForeignKey(GarmentType,on_delete=models.PROTECT,related_name="shop_services")
    price=models.DecimalField(null=False,max_digits=10,decimal_places=2)
    estimated_days=models.PositiveSmallIntegerField(blank=False)
    is_active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        unique_together=('shop','garment_type','service')
        ordering = ['shop']
        

    def __str__(self):
        return f"{self.shop.shop_name} - {self.service.service_name} - {self.garment_type.garment_name}"
