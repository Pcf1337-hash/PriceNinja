import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query;

  if (error) {
    // User denied access or eBay error → deep link with error
    const errorMsg = Array.isArray(error) ? error[0] : error;
    return res.redirect(302, `priceninja://ebay-callback?error=${encodeURIComponent(errorMsg)}`);
  }

  if (!code) {
    return res.redirect(302, `priceninja://ebay-callback?error=no_code`);
  }

  const codeStr = Array.isArray(code) ? code[0] : code;
  const stateStr = state ? (Array.isArray(state) ? state[0] : state) : '';

  // Forward code to native app via deep link
  const deepLink = stateStr
    ? `priceninja://ebay-callback?code=${encodeURIComponent(codeStr)}&state=${encodeURIComponent(stateStr)}`
    : `priceninja://ebay-callback?code=${encodeURIComponent(codeStr)}`;

  return res.redirect(302, deepLink);
}
