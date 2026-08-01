/**
 * Official registry moved into Database center — keep route for deep links.
 */
import { Redirect } from 'expo-router';

export default function OfficialTenantsRedirect() {
  return <Redirect href="/database" />;
}
