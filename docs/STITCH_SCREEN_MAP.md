# Stitch → SPP functional map

Source: `stitch_spp_intelligent_property_agent` HTML mockups  
Target: Expo / React Native app under `frontend/` (historical repo name “SPP_Flutter” is not a Flutter codebase)  
Constraint: **SPP visual identity frozen** (tokens, logo, GlassTabBar) — functions only.

| Stitch screen | Function | SPP route | Status |
|---|---|---|---|
| _1 / _9 | Login | `/beta-login` | existing |
| _2 / executive_dashboard | Executive home | `/` | existing |
| _3 / tenant_detail_profile | Tenant profile tabs | `/tenants/[id]` | **added** |
| _4 / _30 / _31 | Smart assistant | `/brain` | existing |
| _5 | Portfolio | `/portfolio` | existing |
| _7 / _29 | Executive report | `/reports` | existing |
| _8 | Accept delegation | `/roles/accept` | **added** |
| _10 | Send permission link | `/roles` invite | **added** |
| _11/_12/_41 | Control center | `/` + `/hub` | existing |
| _13/_24/_32/_42 | Data hub | `/operational/base` | existing + More menu |
| _14/_26/_33/_43 | Ops center | `/operational/base` | existing |
| intelligent_onboarding | Import wizard | `/upload` | existing |
| _15/_22 | Tenant portal | `/portal/tenant` | existing |
| _16 | New maintenance | `/maintenance/create` | existing |
| _17/_34 / maintenance_management | Tech center | `/portal/tech` + `/maintenance` | existing |
| _18/_36 | Cost evaluation | `/maintenance/[id]` | **added** |
| _19/_35 | Completion / media | `/portal/tech` | existing |
| _20/_28 | Add unit | `/setup/property-os?phase=units` | existing |
| _21/_27 | Add tenant | `/setup/property-os?phase=tenants` | existing |
| _23/_25 | Add property | `/setup/property-os?phase=property` | existing |
| _37 | Owner dashboard | `/owner` | existing |
| _38 | Permissions | `/roles` | existing + invite |
| _40 | Alerts | `/notifications` | existing |
