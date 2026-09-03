-- Auth helper functions and RLS policies

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.auth_roles()
RETURNS user_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT roles FROM profiles WHERE id = auth.uid()),
    '{}'::user_role[]
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(r user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r = ANY (public.auth_roles());
$$;

GRANT EXECUTE ON FUNCTION public.auth_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(user_role) TO authenticated;

-- profiles: own select/update; admin select/insert/update all
CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR has_role('admin'));

CREATE POLICY profiles_update ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR has_role('admin'))
  WITH CHECK (id = auth.uid() OR has_role('admin'));

CREATE POLICY profiles_insert_admin ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (has_role('admin'));

-- settings, communities, transfer_pricing: authenticated select; admin insert/update
CREATE POLICY settings_select ON settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY settings_insert_admin ON settings
  FOR INSERT TO authenticated
  WITH CHECK (has_role('admin'));

CREATE POLICY settings_update_admin ON settings
  FOR UPDATE TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY communities_select ON communities
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY communities_insert_admin ON communities
  FOR INSERT TO authenticated
  WITH CHECK (has_role('admin'));

CREATE POLICY communities_update_admin ON communities
  FOR UPDATE TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY transfer_pricing_select ON transfer_pricing
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY transfer_pricing_insert_admin ON transfer_pricing
  FOR INSERT TO authenticated
  WITH CHECK (has_role('admin'));

CREATE POLICY transfer_pricing_update_admin ON transfer_pricing
  FOR UPDATE TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

-- vehicles: admin all; owner can select
CREATE POLICY vehicles_admin_all ON vehicles
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY vehicles_owner_select ON vehicles
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- compensation_agreements: admin all; user can select own
CREATE POLICY compensation_admin_all ON compensation_agreements
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY compensation_own_select ON compensation_agreements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- transfers: admin all; driver select+limited update; vehicle owner select
CREATE POLICY transfers_admin_all ON transfers
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY transfers_driver_select ON transfers
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY transfers_owner_select ON transfers
  FOR SELECT TO authenticated
  USING (vehicle_owner_id = auth.uid());

CREATE POLICY transfers_driver_update ON transfers
  FOR UPDATE TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

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
  IF public.has_role('admin') THEN
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

CREATE TRIGGER transfers_restrict_driver_update
  BEFORE UPDATE ON transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_transfer_driver_update();

-- trip_status_log: admin all; related driver select/insert
CREATE POLICY trip_status_log_admin_all ON trip_status_log
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY trip_status_log_driver_select ON trip_status_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transfers t
      WHERE t.id = trip_status_log.transfer_id
        AND t.driver_id = auth.uid()
    )
  );

CREATE POLICY trip_status_log_driver_insert ON trip_status_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transfers t
      WHERE t.id = trip_status_log.transfer_id
        AND t.driver_id = auth.uid()
    )
  );

-- grocery_status_log: admin all; related shopper select/insert
CREATE POLICY grocery_status_log_admin_all ON grocery_status_log
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY grocery_status_log_shopper_select ON grocery_status_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grocery_orders o
      WHERE o.id = grocery_status_log.order_id
        AND o.shopper_id = auth.uid()
    )
  );

CREATE POLICY grocery_status_log_shopper_insert ON grocery_status_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grocery_orders o
      WHERE o.id = grocery_status_log.order_id
        AND o.shopper_id = auth.uid()
    )
  );

-- grocery_orders: admin all; shopper select + limited update
CREATE POLICY grocery_orders_admin_all ON grocery_orders
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY grocery_orders_shopper_select ON grocery_orders
  FOR SELECT TO authenticated
  USING (shopper_id = auth.uid());

CREATE POLICY grocery_orders_shopper_update ON grocery_orders
  FOR UPDATE TO authenticated
  USING (shopper_id = auth.uid())
  WITH CHECK (shopper_id = auth.uid());

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
  IF public.has_role('admin') THEN
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

CREATE TRIGGER grocery_orders_restrict_shopper_update
  BEFORE UPDATE ON grocery_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_grocery_shopper_update();

-- payouts, payout_items: admin all; own select
CREATE POLICY payouts_admin_all ON payouts
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY payouts_own_select ON payouts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY payout_items_admin_all ON payout_items
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY payout_items_own_select ON payout_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payouts p
      WHERE p.id = payout_items.payout_id
        AND p.user_id = auth.uid()
    )
  );

-- notifications: admin all; own select and update is_read
CREATE POLICY notifications_admin_all ON notifications
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY notifications_own_select ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_own_update ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.restrict_notification_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_is_read boolean;
BEGIN
  IF public.has_role('admin') THEN
    RETURN NEW;
  END IF;

  new_is_read := NEW.is_read;
  NEW := OLD;
  NEW.is_read := new_is_read;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_restrict_update
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_notification_update();

-- gps_points: admin select; driver insert/select own
CREATE POLICY gps_points_select ON gps_points
  FOR SELECT TO authenticated
  USING (has_role('admin') OR driver_id = auth.uid());

CREATE POLICY gps_points_driver_insert ON gps_points
  FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());
