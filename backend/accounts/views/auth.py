from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.serializers import CustomerRegistrationSerializer


class CustomerRegistrationView(APIView):

    # Registration must be accessible without logging in.
    permission_classes = [AllowAny]

    def post(self, request):

        serializer = CustomerRegistrationSerializer(
            data=request.data
        )

        # Validate the submitted registration data.
        if serializer.is_valid():

            # Create the customer account.
            serializer.save()

            return Response(
                {
                    "message": "Customer registered successfully."
                },
                status=status.HTTP_201_CREATED
            )

        # Return validation errors to the frontend.
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )