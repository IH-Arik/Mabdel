from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.repositories.auth_repository import AuthRepository
from app.repositories.otp_repository import OTPRepository
from app.repositories.token_repository import TokenRepository
from app.schemas.auth_schema import (
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SendOTPRequest,
    TokenResponse,
    UserResponse,
    VerifyOTPRequest,
)
from app.schemas.common import ApiErrorResponse, ApiResponse
from app.schemas.dashboard_schemas import OwnerCreateRequest
from app.core.security import hash_password
from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from app.services.otp_service import OTPService
from app.utils.responses import success_response

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_email_service() -> EmailService:
    return EmailService()


def get_otp_service(
    db: AsyncIOMotorDatabase = Depends(get_database),
    email_service: EmailService = Depends(get_email_service),
) -> OTPService:
    return OTPService(otp_repository=OTPRepository(db), email_service=email_service)


def get_auth_service(
    db: AsyncIOMotorDatabase = Depends(get_database),
    otp_service: OTPService = Depends(get_otp_service),
) -> AuthService:
    return AuthService(
        auth_repository=AuthRepository(db),
        otp_service=otp_service,
        token_repository=TokenRepository(db),
    )


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[MessageResponse],
    responses={409: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def register(payload: RegisterRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.register_user(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
    responses={401: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def login(payload: LoginRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    tokens = await auth_service.login_user(payload)
    return success_response(data=tokens.model_dump(), message="Login successful.")


@router.post(
    "/send-otp",
    response_model=ApiResponse[MessageResponse],
    responses={400: {"model": ApiErrorResponse}, 404: {"model": ApiErrorResponse}, 429: {"model": ApiErrorResponse}},
)
async def send_otp(payload: SendOTPRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.send_otp(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/resend-otp",
    response_model=ApiResponse[MessageResponse],
    responses={400: {"model": ApiErrorResponse}, 404: {"model": ApiErrorResponse}, 429: {"model": ApiErrorResponse}},
)
async def resend_otp(payload: SendOTPRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.resend_otp(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/verify-otp",
    response_model=ApiResponse[MessageResponse],
    responses={400: {"model": ApiErrorResponse}, 429: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def verify_otp(payload: VerifyOTPRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.verify_otp(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/forgot-password",
    response_model=ApiResponse[MessageResponse],
    responses={404: {"model": ApiErrorResponse}, 429: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def forgot_password(payload: ForgotPasswordRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.forgot_password(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/reset-password",
    response_model=ApiResponse[MessageResponse],
    responses={400: {"model": ApiErrorResponse}, 401: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def reset_password(payload: ResetPasswordRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.reset_password(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/subscription-signup",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[MessageResponse],
)
async def subscription_signup(
    payload: OwnerCreateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    from app.services.dashboard.credential_generator import generate_login_email, generate_secure_password
    
    while True:
        generated_login_email = generate_login_email(payload.business_name, "owner")
        existing = await db.users.find_one({"email": generated_login_email})
        if not existing:
            break
            
    generated_password = generate_secure_password()
    hashed_pw = hash_password(generated_password)
    
    from app.utils.helpers import utc_now
    from datetime import timedelta
    now = utc_now()
    
    plan_name = "7-Day Trial"
    expiration = now + timedelta(days=7)
    
    if payload.plan == "subscribe":
        plan_name = "Monthly"
        expiration = now + timedelta(days=30)
        
    user_doc = {
        "email": generated_login_email,
        "original_email": payload.original_email,
        "password_hash": hashed_pw,
        "full_name": payload.full_name,
        "created_by": "system",
        "is_subordinate_account": False,
        "business_name": payload.business_name,
        "business_address": payload.business_address,
        "owner_dob": payload.owner_dob,
        "phone_no": payload.phone_no,
        "business_type": payload.business_type,
        "role": "owner",
        "primary_role": "owner",
        "roles": ["owner"],
        "is_verified": True,
        "is_active": True,
        "subscription_plan": plan_name,
        "subscription_expiration": expiration,
        "created_at": now,
        "updated_at": now,
    }
    
    result = await db.users.insert_one(user_doc)
    new_user_id = str(result.inserted_id)

    # Assign role
    from app.repositories.dashboard.rbac_repository import RBACRepository
    repo = RBACRepository(db)
    role_doc = await repo.get_role_by_slug("owner")
    if role_doc:
        await repo.assign_role(
            user_id=new_user_id,
            role_id=str(role_doc["_id"]),
            role_slug="owner",
            assigned_by="system",
            organization_id=None,
        )

    # Create Global Chat for the new organization (the owner is the organization)
    from app.services.smartflow.smartflow_orchestrator import SmartFlowService
    smartflow = SmartFlowService(db)
    await smartflow.ensure_global_chat(
        organization_id=new_user_id,
        business_name=payload.business_name,
        owner_id=new_user_id
    )

    # Send credentials
    from app.services.email_service import EmailService
    await EmailService().send_subordinate_credentials_email(
        email=payload.original_email,
        login_email=generated_login_email,
        password=generated_password,
        role="owner"
    )

    # Print credentials to console for local development testing
    print(f"\n=== [LOCAL DEV] NEW OWNER CREDENTIALS ===")
    print(f"Original Email: {payload.original_email}")
    print(f"Login Email: {generated_login_email}")
    print(f"Password: {generated_password}")
    print(f"=========================================\n")

    return success_response(data={"message": "Subscription request received. Credentials have been emailed."}, message="Success")


@router.post(
    "/refresh-token",
    response_model=ApiResponse[TokenResponse],
    responses={401: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def refresh_token(payload: RefreshTokenRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.refresh_access_token(payload)
    return success_response(data=result.model_dump(), message="Token refreshed successfully.")


@router.post(
    "/google",
    response_model=ApiResponse[TokenResponse],
    responses={400: {"model": ApiErrorResponse}, 401: {"model": ApiErrorResponse}, 503: {"model": ApiErrorResponse}},
)
async def google_login(payload: GoogleLoginRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.google_login(payload)
    return success_response(data=result.model_dump(), message="Google login successful.")


@router.get(
    "/me",
    response_model=ApiResponse[UserResponse],
    responses={401: {"model": ApiErrorResponse}},
)
async def me(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> dict:
    user = await auth_service.get_current_user(token)
    return success_response(data=user.model_dump(), message="Current user fetched successfully.")


@router.post(
    "/logout",
    response_model=ApiResponse[MessageResponse],
    responses={401: {"model": ApiErrorResponse}},
)
async def logout(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> dict:
    result = await auth_service.logout(token)
    return success_response(data=result.model_dump(), message="Logged out successfully.")
