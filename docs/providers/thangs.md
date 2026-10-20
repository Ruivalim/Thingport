# <img src="../assets/providers/thangs.svg" alt="" width="36" height="36" align="absmiddle"> Thangs

A 3D model search engine by Physna that finds models by their shape as well as their name, with a marketplace and
designer memberships. Its details, anyone's likes and public collections need nothing; its files go only to a signed-in
user.

| At a glance    |                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------- |
| Sign-in        | Your own Thangs sign-in, per user; Thingport renews it for about a year                      |
| Thingport Grab | **Recommended** -- connects your account in one visit                                        |
| FlareSolverr   | Optional -- used for public reads if Cloudflare challenges the server                        |
| Imports        | Free and owned models, your likes and collections, [synced](../guides/synced-collections.md) |

## What comes in

- A model comes in as one file, or as the zip of all its parts that Thangs builds, each part its own file in Thingport.
- Your own likes and collections, private ones included.
- **Daily downloads.** Free Thangs accounts download a limited number of models a day. Once yours are used up, a
  collection or likes import stops and says so, and a synced collection leaves the rest for its next check.
- **Paid models** download once your account owns them: bought on their own or in a bundle, or included in a
  membership you're in. Paid models you don't own are left out of collection imports and syncs.
- **Print-only models**, which a designer sells only as a print, have no files and can't be imported.

## Setup

Per-user (**Configuration → Providers → Thangs**). The sign-in is two cookies: `accessToken`, which lasts a week, and
`refreshToken`, which renews it and lasts about a year. Thingport renews the access token itself, so it stays connected
until you sign out of Thangs or the refresh token runs out.

### Easiest: Thingport Grab

With [Thingport Grab](../../extension/README.md) allowed on Thangs, opening thangs.com while you're signed in connects
your account. If Thangs turns the sign-in down, Thingport says so, and your next visit connects it again.

### Manual: copy it from your browser

1. Sign in at [thangs.com](https://thangs.com).
2. Open DevTools (`F12`, or `Cmd+Option+I` on macOS) and reload the page.
3. On the **Network** tab, pick any request to `thangs.com/api` and copy its `Cookie` request header, which holds both
   tokens. The `refreshToken` cookie alone works too, as does the `Authorization` header, though that one lasts only a
   week.
4. Right-click **Thangs** in **Configuration → Providers**, choose **Connect** and paste it.
