# Provider setup

Importing from **Printables** works out of the box (its public API needs no credential). **MakerWorld** needs each user's own session cookie, and **Thingiverse** an App Token an admin sets once for the whole instance. **MyMiniFactory** needs an API key an admin sets once for free models; each user connects their own MyMiniFactory session only to import paid or sign-in-only models from their library. **Snapmaker Space** needs each user's own sign-in, which [Thingport Grab](../extension/README.md) keeps fresh. **MakerOnline** reads its models and public collections with nothing, but hands out files only through Thingport Grab; each user's own sign-in adds their likes and private collections. **Creality Cloud** reads its models and collections with nothing, but gives files and likes only to each user's own sign-in, which Thingport Grab sends on. **NexPrint** reads its models and collections, private ones included, with nothing, and gives files only to each user's own sign-in, which Thingport Grab sends on. **Thangs** reads its models, likes and public collections with nothing, and gives files only to each user's own sign-in, which Thingport Grab sends on and Thingport keeps renewed for about a year. **Cults3D** is read with each user's own API key, and gives files only to the user's browser sign-in, which Thingport Grab sends on.

Connect them under **Configuration → Providers**: open the user menu (your avatar, top right) and choose **Configuration**, or click one of the provider chips at the bottom of that menu. Right-click a provider to connect or disconnect it, or double-click one that isn't connected yet. A green tick means it's connected. A provider your admin has [turned off](#turning-a-provider-off) isn't listed.

![Configuration, Providers section with MakerWorld, Thingiverse, Printables and MyMiniFactory connected](../frontend/src/assets/screenshots/11_configuration_providers.png)

## Thingiverse App Token

Instance-wide, admin-configured (Configuration > Providers > Thingiverse, or Administration > Providers > Thingiverse App Token) -- one token is shared by every user's Thingiverse imports. Other users see Thingiverse as connected once an admin has set it up.

1. Sign in to your Thingiverse account, then go to [thingiverse.com/apps/create](https://www.thingiverse.com/apps/create).
2. Register a new app. The name/description don't matter for this; pick whichever Application Type doesn't require a redirect URL (e.g. "Desktop" or "Mobile") -- a "Web App" asks for OAuth details you don't need here.
3. Once created, Thingiverse shows an **App Token** for it. This is different from your Thingiverse login password -- it's a permanent credential tied to that registered app.
4. Copy it, right-click **Thingiverse** in Thingport's **Configuration > Providers**, choose **Connect** and paste it. Thingport verifies the token against Thingiverse before storing it, so a mistyped or revoked token is rejected immediately with a clear error instead of only failing on the next import.

Treat this token like a password: anyone who has it can use it to act as your Thingiverse app. If it's ever exposed, revoke it from your Thingiverse account's Apps page and generate a new one.

## MyMiniFactory API key

Instance-wide and admin-configured, like the Thingiverse token (Configuration > Providers > MyMiniFactory, or Administration > Providers > MyMiniFactory API key). Thingport uses it to read models' details, collections and authors; the files of free models download without it.

1. Sign in to your MyMiniFactory account, then go to [myminifactory.com/settings/developer](https://www.myminifactory.com/settings/developer).
2. Create an application. Its name doesn't matter.
3. Copy the application's **API key** -- not its client ID or client secret, which are for signing users in and won't work here.
4. Save it under **Administration > Providers > MyMiniFactory API key**. Thingport checks the key against MyMiniFactory before storing it.

With the key alone, free models import for everyone. **Paid models** you bought, and free ones whose files only download when signed in, come from your own MyMiniFactory library, so each user connects their MyMiniFactory account too.

## MyMiniFactory account

Per-user (Configuration > Providers > MyMiniFactory). Thingport downloads your bought and sign-in-only models as you, from your MyMiniFactory library, using your browser's MyMiniFactory session. Where MyMiniFactory has unpacked a model's archives, Thingport fetches just the model files from them, so RAR archives and very large zips are no problem.

### Easiest: Thingport Grab

With [Thingport Grab](../extension/README.md) allowed on MyMiniFactory, opening a myminifactory.com page while you're signed in connects your account with your current session. MyMiniFactory renews that session from time to time; the next page you open sends the new one.

### Manual: copy it from your browser

1. Sign in at [myminifactory.com](https://www.myminifactory.com).
2. Open DevTools (`F12`, or `Cmd+Option+I` on macOS).
3. Chrome/Edge: **Application** tab > **Cookies** > `https://www.myminifactory.com`. Firefox: **Storage** tab > **Cookies**.
4. Copy the value of the cookie named `PHPSESSID`. (Pasting the whole `Cookie` request header works too: Thingport keeps only `PHPSESSID`.)
5. Right-click **MyMiniFactory** in Thingport's **Configuration > Providers**, choose **Connect** and paste it. Thingport checks it with MyMiniFactory before storing it.

This is your own MyMiniFactory login session -- don't share it. It expires once you sign out of MyMiniFactory, or after a while; Thingport then says so, and opening MyMiniFactory with Thingport Grab connects it again. A paid model you haven't bought can't be imported: Thingport Grab says so on its page.

## Snapmaker Space sign-in

Per-user (Configuration > Providers > Snapmaker Space). Snapmaker gives its files only to signed-in users, so every
Snapmaker import, and reading your likes and bookmarks, runs as you. A model comes in like a MakerWorld one: its print
profile's 3MF, as a file tagged with the profile, and importing it again with another profile (or picking the
designer's or all profiles) adds more; a model without print profiles brings its model files instead.

Snapmaker's sign-in lasts a day, and its renewal can be used only once: whoever renews it signs out anyone else still
holding the old one. So Thingport never renews it itself.

### Easiest: Thingport Grab

With [Thingport Grab](../extension/README.md) allowed on Snapmaker Space, opening space.snapmaker.com while you're
signed in connects your account. From then on Grab renews the sign-in for your browser and Thingport together, every
few hours while the browser is open, so imports and synced likes and bookmarks keep working without another visit.
If the browser stays closed for a day, Thingport says the sign-in ran out, and the next visit connects it again.

### Manual: copy it from your browser

1. Sign in at [space.snapmaker.com](https://space.snapmaker.com).
2. Open DevTools (`F12`, or `Cmd+Option+I` on macOS).
3. Chrome/Edge: **Application** tab > **Cookies** > `https://space.snapmaker.com`. Firefox: **Storage** tab > **Cookies**.
4. Copy the value of the cookie named `login_access_token`. (Pasting the whole `Cookie` header, or an
   `Authorization: Bearer` value, works too.)
5. Right-click **Snapmaker Space** in Thingport's **Configuration > Providers**, choose **Connect** and paste it.
   Thingport checks it with Snapmaker before storing it.

A sign-in pasted by hand lasts a day; only Grab renews it. Don't copy `login_refresh_token`: renewing with it would sign
your browser out of Snapmaker.

## MakerOnline

MakerOnline's model details, categories and public collections need nothing. Its files are another matter: its download
call wants a token that only its own anti-bot script makes, in a real makeronline.com page. So every MakerOnline file
comes through [Thingport Grab](../extension/README.md), allowed on MakerOnline from its popup:

- On a model page, Grab's panel imports it straight away, with the print profile you pick (or the designer's, or all of
  them), just like MakerWorld.
- A MakerOnline link pasted in Thingport, a collection or your likes imported in Thingport, and new models in a synced
  MakerOnline collection wait for Grab. The next time you open any makeronline.com page in a browser with Grab, it
  imports them there and files them where they were meant to go. A model that fails three times is dropped, with a
  notification saying why.

If MakerOnline asks for a captcha, download one file from a model page by hand and solve it, then reload.

### Your MakerOnline sign-in

Per-user (Configuration > Providers > MakerOnline): it lets Thingport read your likes and private collections, to import
or sync them. Opening makeronline.com signed in, with Grab allowed there, connects it. By hand:

1. Sign in at [makeronline.com](https://www.makeronline.com).
2. Open DevTools (`F12`, or `Cmd+Option+I` on macOS).
3. Chrome/Edge: **Application** tab > **Cookies** > `https://www.makeronline.com`. Firefox: **Storage** tab > **Cookies**.
4. Copy the value of the cookie named `mo_access_token`. (Pasting the whole `Cookie` header works too.)
5. Right-click **MakerOnline** in Thingport's **Configuration > Providers**, choose **Connect** and paste it. Thingport
   checks it with MakerOnline before storing it.

It lasts about three months; Grab sends the new one whenever you sign in again.

## Creality Cloud

Per-user (Configuration > Providers > Creality Cloud). Creality Cloud's model details, print profiles and collections,
private ones included, need nothing; its files and your likes are given only to a signed-in user, so every Creality
Cloud import, and reading your likes, runs as you. A model comes in like a MakerWorld one: its print profile's 3MF, as a
file tagged with the profile, and importing it again with another profile (or picking the designer's or all profiles)
adds more; a model without print profiles brings its model files instead.

Its sign-in is two cookies, `model_token` and `model_user_id`, which its API takes together. The site sets them once
when you sign in, for a week, and never renews them; Thingport doesn't either.

### Easiest: Thingport Grab

With [Thingport Grab](../extension/README.md) allowed on Creality Cloud, opening crealitycloud.com while you're signed
in connects your account, and sends the new sign-in each time you sign in there again. Once a week has passed,
Thingport says the sign-in ran out, and your next sign-in on crealitycloud.com connects it again.

### Manual: copy it from your browser

1. Sign in at [crealitycloud.com](https://www.crealitycloud.com).
2. Open DevTools (`F12`, or `Cmd+Option+I` on macOS) and reload the page.
3. On the **Network** tab, pick any request to `crealitycloud.com/api` and copy its `Cookie` request header. (Its
   `__cxy_token_` and `__cxy_uid_` request headers, copied together, work too.)
4. Right-click **Creality Cloud** in Thingport's **Configuration > Providers**, choose **Connect** and paste it.
   Thingport checks it with Creality Cloud before storing it.

## NexPrint

Per-user (Configuration > Providers > NexPrint). NexPrint's model details, print profiles, categories and collections,
private ones included, need nothing; its files are given only to a signed-in user, so every NexPrint import runs as
you. A model comes in like a MakerWorld one: its print profile's 3MF, as a file tagged with the profile, and importing
it again with another profile (`?printConfigId=` in the link, or picking the designer's or all profiles) adds more; a
model without print profiles brings its model files instead. NexPrint lists no liked models anywhere, so there are no
likes to import or sync.

Its sign-in is one token, the `auth_token` cookie, which its API takes as a Bearer token. The site keeps the cookie for
a week and sets it again as it refreshes the token while you use it.

### Easiest: Thingport Grab

With [Thingport Grab](../extension/README.md) allowed on NexPrint, opening nexprint.com while you're signed in connects
your account, and sends the new token whenever the site renews it. If NexPrint turns it down, Thingport says the
sign-in ran out, and your next visit to nexprint.com connects it again.

### Manual: copy it from your browser

1. Sign in at [nexprint.com](https://www.nexprint.com).
2. Open DevTools (`F12`, or `Cmd+Option+I` on macOS) and reload the page.
3. On the **Network** tab, pick any request to `nexprint.com/gateway` and copy its `Authorization` request header (or
   the `auth_token` cookie, or the whole `Cookie` header).
4. Right-click **NexPrint** in Thingport's **Configuration > Providers**, choose **Connect** and paste it. Thingport
   checks it with NexPrint before storing it.

## Thangs

Per-user (Configuration > Providers > Thangs). Thangs' model details, categories, anyone's liked models and public
collections need nothing; its files are given only to a signed-in user, so every Thangs import runs as you. A model
comes in as one file, or as the zip of all its parts that Thangs builds, each part its own file in Thingport. Your own
likes and collections, private ones included, can be imported and synced.

- **Daily downloads.** Free Thangs accounts download a limited number of models a day. Once yours are used up, a
  collection or likes import stops asking and says so, and a synced collection leaves the rest for its next check.
- **Paid models.** A model for sale, or for a designer membership's members, downloads only once your account owns it:
  bought on its own or in a bundle, or included in a membership you're in. Paid models you don't own are left out of
  collection imports and syncs.
- **Print-only models.** Some designers sell a model only as a print, and Thangs offers no files for it, so it can't be
  imported.

Its sign-in is two cookies: `accessToken`, a token that lasts a week and goes to its API as a Bearer token, and
`refreshToken`, which renews it and lasts about a year. Thingport renews the access token itself, so it stays connected
until you sign out of Thangs or the refresh token runs out.

### Easiest: Thingport Grab

With [Thingport Grab](../extension/README.md) allowed on Thangs, opening thangs.com while you're signed in connects
your account. If Thangs turns the sign-in down, Thingport says it ran out, and your next visit to thangs.com connects it
again.

### Manual: copy it from your browser

1. Sign in at [thangs.com](https://thangs.com).
2. Open DevTools (`F12`, or `Cmd+Option+I` on macOS) and reload the page.
3. On the **Network** tab, pick any request to `thangs.com/api` and copy its `Cookie` request header, which holds both
   tokens. The `refreshToken` cookie alone works too, as does the `Authorization` header, though that one lasts only a
   week.
4. Right-click **Thangs** in Thingport's **Configuration > Providers**, choose **Connect** and paste it. Thingport checks
   it with Thangs before storing it.

## Cults3D

Per-user (Configuration > Providers > Cults3D), in two parts.

**Your API key** reads everything but the files: model details, categories, anyone's liked models, your own printlists
(Cults3D's collections; its API shows no one else's) and your downloads. Make one at
[cults3d.com/en/api/keys](https://cults3d.com/en/api/keys), then right-click **Cults3D** in **Configuration >
Providers**, choose **Connect**, and enter your nickname exactly as your profile writes it (its capitals count) and the
key's secret. Thingport checks them with Cults3D before storing them.

**Your browser's sign-in** downloads the files. They're on Cults3D's own pages, behind a Cloudflare check only a browser
passes, so Thingport uses your browser's: the `_session_id` sign-in cookie, and the `cf_clearance` cookie Cloudflare
gave your browser, sent with that browser's User-Agent. Cloudflare ties that clearance to your IP address too, so it
only works while Thingport reaches the internet from the same address as your browser, as a server at home does.
FlareSolverr doesn't help here: its browser can't hand over a download link. The sign-in lasts 20 days from its last
use, and Thingport's own use renews it.

- **Free models** you haven't downloaded yet are added to your Cults3D downloads first, as the site's own Download
  button does. A model comes in as the zip Cults3D builds of its files, each one its own file in Thingport.
- **Paid models** download only once you've bought them. Paid models you don't own are left out of likes and printlist
  imports and syncs.

### Easiest: Thingport Grab

With [Thingport Grab](../extension/README.md) allowed on Cults3D, opening cults3d.com while you're signed in sends the
sign-in and clearance, and again whenever they change. If Cults3D turns them down, Thingport says so, and your next
visit sends new ones.

### Manual: copy it from your browser

1. Sign in at [cults3d.com](https://cults3d.com).
2. Open DevTools (`F12`, or `Cmd+Option+I` on macOS) and reload the page.
3. On the **Network** tab, pick the page's own request and copy its request headers, with the `Cookie` and
   `User-Agent` ones.
4. Right-click **Cults3D** in Thingport's **Configuration > Providers**, choose **Paste browser sign-in** and paste
   them.

## MakerWorld cookie

Per-user (Configuration > Providers > MakerWorld) -- MakerWorld has no developer API, so importing from it runs as _your own_ logged-in MakerWorld session, captured as a cookie value.

### Easiest: Thingport Grab

The [Thingport Grab](../extension/README.md) browser extension captures this automatically the first time you import something from a MakerWorld tab where you're already logged in -- there's nothing to copy by hand.

### Manual: copy it from your browser

1. Log in at [makerworld.com](https://makerworld.com) in your browser.
2. Open DevTools (`F12`, or `Cmd+Option+I` on macOS).
3. Chrome/Edge: go to the **Application** tab > **Cookies** > `https://makerworld.com`. Firefox: **Storage** tab > **Cookies** > `https://makerworld.com`.
4. Find the cookie named `token` and copy its **Value** column -- just that raw value, nothing else needs adding.
5. Right-click **MakerWorld** in Thingport's **Configuration > Providers**, choose **Connect** and paste it. Thingport verifies it against MakerWorld before storing it, so a stale or mistyped paste is rejected immediately instead of only failing on the next import.

If there's no cookie named `token` (MakerWorld occasionally renames things), use the **Network** tab instead: reload the page, click any request to `makerworld.com`, open its Request Headers, and copy the whole `cookie:` value. Thingport only pulls the `token=...` part out of it and ignores the rest, so pasting the entire header works too.

This is your own MakerWorld login session -- don't share it, and expect to redo this occasionally, since MakerWorld sessions eventually expire.

## Turning a provider off

Admins choose which providers this Thingport imports from, under **Administration → Providers**. All ten are on by
default. Turn one off and nothing new comes from it for anyone: links to it, Thingport Grab and the import queue are
refused, its synced collections pause, and background jobs skip it. It also disappears from everyone's
**Configuration → Providers**. Models already imported from it stay as they are, and turning it back on picks up where
it left off. The Thingiverse App Token and the MyMiniFactory API key are set on the same page.
