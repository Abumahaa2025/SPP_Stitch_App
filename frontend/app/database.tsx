/**
 * Database center — redirected into Data & operations hub (official registry tab).
 */
import { Redirect } from 'expo-router';

export default function DatabaseCenterScreen() {
  return <Redirect href="/operational/base?tab=registry" />;
}
