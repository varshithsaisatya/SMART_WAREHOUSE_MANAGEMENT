#!/bin/bash

# Backend Environment Variables Setup Script
# Generated from Vly for Git Sync
# Run this script to set up your Convex backend environment variables

echo 'Setting up Convex backend environment variables...'

# Check if Convex CLI is installed
if ! command -v npx &> /dev/null; then
    echo 'Error: npx is not installed. Please install Node.js and npm first.'
    exit 1
fi

echo "Setting JWKS..."
bunx convex env set "JWKS" -- "{\"keys\":[{\"kty\":\"RSA\",\"n\":\"mVRu8ppBPiskBZtQF060TGy-cZabJHMYeTvBTNb-9Y_nbdtbKSoa_OhIdTHZA2MT8XqretEPH-uRRcJeVVUSzChndiI_0dezJ5NIDC141Sb6DKUQ04opWoqLr8z8tzZcQKYP6-z_WhuCOX-QstG1vokOUmU5zOy9d8ewFYHSG5w_Zrb4mT7o6pYnN37R-MgfvBp9TLnlJPbBu5aZWqTb30fgML5zBAE7oY9b7E1GeZaT2F026Cl8Yf8_LnexwFKKyIid_iE_m2b074XER7dc6D6Z4CwAssf6cgXeEHCofHQbfnM50t0ttXhObCLUUXqaleNyw6gzqgDF6fUl-vdvLw\",\"e\":\"AQAB\",\"use\":\"sig\"}]}"

echo "Setting JWT_PRIVATE_KEY..."
bunx convex env set "JWT_PRIVATE_KEY" -- "-----BEGIN PRIVATE KEY----- MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCZVG7ymkE+KyQF m1AXTrRMbL5xlpskcxh5O8FM1v71j+dt21spKhr86Eh1MdkDYxPxeqt60Q8f65FF wl5VVRLMKGd2Ij/R17Mnk0gMLXjVJvoMpRDTiilaiouvzPy3NlxApg/r7P9aG4I5 f5Cy0bW+iQ5SZTnM7L13x7AVgdIbnD9mtviZPujqlic3ftH4yB+8Gn1MueUk9sG7 lplapNvfR+AwvnMEATuhj1vsTUZ5lpPYXTboKXxh/z8ud7HAUorIiJ3+IT+bZvTv hcRHt1zoPpngLACyx/pyBd4QcKh8dBt+cznS3S21eE5sItRRepqV43LDqDOqAMXp 9SX6928vAgMBAAECggEAEfkFsEZIk4L3C/kyoCjHlZXBlQr0UId1PPC2Lc2dwScH F6d4vhCDbVXE+IfJSk5Yzht08kaDIVi5hJXN/O6l72xlBEHrfSttgpwO++5wlXum H8lReZpeUpCe4xKCJO+oTKOqhhsXq3ZCA39idLOEPDtQhHP9HHo7k0jC6SJ4gGfX ts5EVoUO/iyI+knIup52F/yEuokwr1lPGa9ohSIq6CImhl9LJJj8jNdKVuCzbZl3 ObDIouo2bZ1BnJeHLv8Of2usTYHFCxZRiozEkct4owA4J8All/4A9gkjFJ4n0/rV Z1MPFoQu/dDWyORJ5FjanZUw8ngT7bjkkhmFzl4k0QKBgQDSYta7wCXJc8J9dzUr cOkOK7fsJ59k0+8m5pY/ANjVQ5behcWhX8qf1S4nuh+P6Y1Xlw+2ehXva1sts+Nf B9wvFCccqrq70jNbWTeSdMemI3/11LzGtTYuBcbg01bq1KjKnlkx4klgrVfCZfKu iFp1E0zjF6zj75DsYovCQdpe8wKBgQC6ksXOc1hBjCuaD6RCegkIr0o3VUsuYvVl A05CVsZb+dTolx3TT7Kazer+zedBLuXzTV2vwtN0tXfn0/wahIjWQb0GHlhd5oxs K4XgSwl+KuO51wm90XYKZ8b7tsLQtm9cRGS7LIT0Wtg2Y4cqXP7bP4uc8kM2eY9M ZjebC7GV1QKBgQCy+XJDdkqu/dNOeMK6mespKvfj5jEqzUB9j1vxbP8JLd6Cnrpp ddwh7HC/Sw7eloivIsszKNjQPDvsvUOH7F/bjQFY2cTRUxhtdZBY/w94vmp07u1I /Y+Bx1hQmnkufIq7E8o9LYvOuqgVsDSrVUPepPSbm+BwZ7SZ45uRPgRPEQKBgCYF u2Izh4z0L/6ZqXQSwryOXKWiMEwnxrLrVYuXe51K8OTlxyJFX7TEultrQvG5yQso fStQnR9vzBvmy73rvKdNhmQ00vVwArYYuJPZNvoLa5V4CXgxs8izFY4+1L0MMO2w 0oaCsCXMTbvn1KgBg77S2HUHukLjyxxayIJEg9BxAoGBALSEOtqKVsI5UIKwhHDP +2m1OGRDURqaKcKGOexx4OV1/jkEmMefTRh/IsNfOCVcXX9+eb/fBGKA+lI/JVd4 10L3LwUr8ujnp95sAlo2MHzqar3PUiM5wp/uzN2Vit8iFeqxWmD5iPmeGEsWktDF kvTDPvEmwEnz3jmqoERMUt5d -----END PRIVATE KEY-----"

echo "Setting SITE_URL..."
bunx convex env set "SITE_URL" -- "https://giddy-ptarmigan-549.convex.site"

echo "Setting VLY_APP_NAME..."
bunx convex env set "VLY_APP_NAME" -- "Glass Fulfill AI"

echo "Setting VLY_CONVEX_AUTH_ISSUER..."
bunx convex env set "VLY_CONVEX_AUTH_ISSUER" -- "https://freebuff.com"

echo "Setting VLY_INTEGRATION_BASE_URL..."
bunx convex env set "VLY_INTEGRATION_BASE_URL" -- "https://integrations.vly.ai/"

echo "Setting VLY_INTEGRATION_KEY..."
bunx convex env set "VLY_INTEGRATION_KEY" -- "sk_892efb3fb4baed431423d1e6cbd3fc7089b9be94692060ae8d22e2c3faeb88b4"

echo "✅ All backend environment variables have been set!"
echo "You can now run: pnpm dev:backend"
