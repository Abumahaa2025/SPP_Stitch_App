/**
 * Tenants — redirected into Data & operations hub (tenants tab).
 */
import { Redirect } from 'expo-router';

export default function Tenants() {
  return <Redirect href="/operational/base?tab=tenants" />;
}
