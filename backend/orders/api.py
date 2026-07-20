from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from .serializers import OrderSerializer
from .models import Order
from users.permissions import IsPlatformAdmin



class OrderViewSet(ModelViewSet):

    queryset=Order.objects.all()
    serializer_class=OrderSerializer
    permission_classes=[IsAuthenticated,IsPlatformAdmin]

    def get_queryset(self):
        
       if self.request.user.role == "platform_admin":
           return Order.objects.all()
       elif self.request.user.role == "shop_admin":
           return Order.objects.filter(shop__shop_admin=self.request.user)
       elif self.request.user.role == "customer":
           return Order.objects.filter(customer=self.request.user)
       
       return Order.objects.none()
    
    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)