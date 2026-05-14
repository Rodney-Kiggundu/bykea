import TaxiBookingPage from './TaxiBookingPage';

/** Home → Tuk-Tuk tile; persists to `tuk_tuk_bookings` (see supabase/tuk_tuk_bookings.sql). */
export default function TukTukBookingPage() {
  return <TaxiBookingPage variant="tukOnly" />;
}
