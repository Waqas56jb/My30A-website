-- Allow service-role (auth.uid() is null) to persist completion/refund fields.
-- Client-side driver updates remain limited to the allowed columns.

CREATE OR REPLACE FUNCTION public.restrict_transfer_driver_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_status trip_status;
  new_started_at timestamptz;
  new_completed_at timestamptz;
  new_payment_method payment_method;
  new_cash_reported numeric(10, 2);
  new_tip_amount numeric(10, 2);
BEGIN
  IF auth.uid() IS NULL OR public.has_role('admin') THEN
    RETURN NEW;
  END IF;

  new_status := NEW.status;
  new_started_at := NEW.started_at;
  new_completed_at := NEW.completed_at;
  new_payment_method := NEW.payment_method;
  new_cash_reported := NEW.cash_reported;
  new_tip_amount := NEW.tip_amount;

  NEW := OLD;
  NEW.status := new_status;
  NEW.started_at := new_started_at;
  NEW.completed_at := new_completed_at;
  NEW.payment_method := new_payment_method;
  NEW.cash_reported := new_cash_reported;
  NEW.tip_amount := new_tip_amount;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restrict_grocery_shopper_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_status grocery_status;
  new_started_at timestamptz;
  new_delivered_at timestamptz;
  new_receipt_url text;
  new_kitchen_photo_url text;
  new_tip_amount numeric(10, 2);
BEGIN
  IF auth.uid() IS NULL OR public.has_role('admin') THEN
    RETURN NEW;
  END IF;

  new_status := NEW.status;
  new_started_at := NEW.started_at;
  new_delivered_at := NEW.delivered_at;
  new_receipt_url := NEW.receipt_url;
  new_kitchen_photo_url := NEW.kitchen_photo_url;
  new_tip_amount := NEW.tip_amount;

  NEW := OLD;
  NEW.status := new_status;
  NEW.started_at := new_started_at;
  NEW.delivered_at := new_delivered_at;
  NEW.receipt_url := new_receipt_url;
  NEW.kitchen_photo_url := new_kitchen_photo_url;
  NEW.tip_amount := new_tip_amount;

  RETURN NEW;
END;
$$;
