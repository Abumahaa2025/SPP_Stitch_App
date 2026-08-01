/**
 * Database center — home of the official tenant registry (moved, not copied).
 */
import { TenantOfficialRegistry } from '@/src/components/TenantOfficialRegistry';

export default function DatabaseCenterScreen() {
  return <TenantOfficialRegistry variant="database" testID="database-center" />;
}
