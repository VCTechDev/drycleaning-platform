from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from django.utils import timezone
from rest_framework.exceptions import ValidationError


DATE_PRESETS = {"all", "today", "this_week", "this_month"}


@dataclass(frozen=True)
class OrderDateFilter:
    preset: str
    start_date: date | None
    end_date: date | None
    start_datetime: datetime | None
    end_datetime: datetime | None


def _parse_custom_date(parameter, value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValidationError({parameter: "Use YYYY-MM-DD."})


def _date_boundaries(start_date, end_date):
    current_timezone = timezone.get_current_timezone()
    start_datetime = timezone.make_aware(
        datetime.combine(start_date, time.min),
        current_timezone,
    )
    end_datetime = timezone.make_aware(
        datetime.combine(end_date + timedelta(days=1), time.min),
        current_timezone,
    )
    return start_datetime, end_datetime


def parse_order_date_filters(query_params):
    has_preset = "date_preset" in query_params
    preset = query_params.get("date_preset") if has_preset else None
    has_created_from = "created_from" in query_params
    has_created_to = "created_to" in query_params

    if has_preset and preset not in DATE_PRESETS:
        raise ValidationError(
            {
                "date_preset": (
                    "Use one of: all, today, this_week, this_month."
                )
            }
        )

    if has_created_from != has_created_to:
        raise ValidationError(
            {
                "created_from": "created_from and created_to are required together."
            }
        )

    if has_preset and (has_created_from or has_created_to):
        raise ValidationError(
            {
                "date_preset": (
                    "Do not combine date_preset with created_from or created_to."
                )
            }
        )

    if has_created_from and has_created_to:
        start_date = _parse_custom_date(
            "created_from",
            query_params.get("created_from"),
        )
        end_date = _parse_custom_date(
            "created_to",
            query_params.get("created_to"),
        )

        if start_date > end_date:
            raise ValidationError(
                {"created_to": "created_to must be on or after created_from."}
            )

        start_datetime, end_datetime = _date_boundaries(start_date, end_date)
        return OrderDateFilter(
            preset="custom",
            start_date=start_date,
            end_date=end_date,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
        )

    resolved_preset = preset or "all"
    if resolved_preset == "all":
        return OrderDateFilter(
            preset="all",
            start_date=None,
            end_date=None,
            start_datetime=None,
            end_datetime=None,
        )

    today = timezone.localdate()
    if resolved_preset == "today":
        start_date = today
        end_date = today
    elif resolved_preset == "this_week":
        start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(days=6)
    else:
        start_date = today.replace(day=1)
        if start_date.month == 12:
            next_month = date(start_date.year + 1, 1, 1)
        else:
            next_month = date(start_date.year, start_date.month + 1, 1)
        end_date = next_month - timedelta(days=1)

    start_datetime, end_datetime = _date_boundaries(start_date, end_date)
    return OrderDateFilter(
        preset=resolved_preset,
        start_date=start_date,
        end_date=end_date,
        start_datetime=start_datetime,
        end_datetime=end_datetime,
    )


def apply_order_filters(queryset, query_params, date_filters=None):
    date_filters = date_filters or parse_order_date_filters(query_params)

    if date_filters.start_datetime is not None:
        queryset = queryset.filter(
            created_at__gte=date_filters.start_datetime,
            created_at__lt=date_filters.end_datetime,
        )

    order_status = query_params.get("status")
    if order_status:
        queryset = queryset.filter(order_status=order_status)

    payment_status = query_params.get("payment_status")
    if payment_status:
        queryset = queryset.filter(payment_status=payment_status)

    shop_id = query_params.get("shop")
    if shop_id:
        try:
            shop_id = int(shop_id)
            if shop_id < 1:
                raise ValueError
        except (TypeError, ValueError):
            raise ValidationError({"shop": "shop must be a positive integer."})
        queryset = queryset.filter(shop_id=shop_id)

    return queryset, date_filters
