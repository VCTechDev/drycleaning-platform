from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from logistics.models import DeliveryAgent
from logistics.serializers.delivery_agent import DeliveryAgentAvailabilitySerializer
from users.permissions import IsDeliveryAgent


class DeliveryAgentAvailabilityView(APIView):
    """
    Delivery Agent endpoint to view and update availability (online/offline).
    Only authenticated, active delivery agents can update their status.
    """

    permission_classes = [IsAuthenticated, IsDeliveryAgent]

    def get_agent(self, request):
        try:
            return DeliveryAgent.objects.get(user=request.user)
        except DeliveryAgent.DoesNotExist:
            raise PermissionDenied("Delivery agent profile not found.")

    def get(self, request):
        agent = self.get_agent(request)
        return Response({
            "agent_id": agent.id,
            "is_active": agent.is_active,
            "is_online": agent.is_online,
            "shift_starts_at": agent.shift_starts_at,
            "shift_ends_at": agent.shift_ends_at,
        })

    def patch(self, request):
        agent = self.get_agent(request)
        if not agent.is_active:
            raise PermissionDenied("Inactive delivery agent account cannot modify availability.")

        serializer = DeliveryAgentAvailabilitySerializer(
            data=request.data,
            context={"agent": agent, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        agent = serializer.save()
        return Response({
            "agent_id": agent.id,
            "is_active": agent.is_active,
            "is_online": agent.is_online,
        })
