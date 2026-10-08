# Thingport Grab privacy policy

_Effective 6 October 2026._

Thingport Grab is a browser extension that imports 3D-printing models from MakerWorld, Printables
and Thingiverse into **your own self-hosted Thingport instance**, and converts MakerWorld files for
other slicers in your browser. It has no servers of its own: the
extension's developer never receives any of your data, and nothing is shared with anyone else.

## What the extension stores

Everything below is kept in your browser's local extension storage, on your device only, except
the list of recent imports, which is synced between your browsers as described below.

- **Your Thingport connection:** the address of your Thingport instance, and the email and password
  you sign in to it with. They're stored as you entered them, so the extension can sign in again
  when its session expires.
- **A session token** your Thingport instance issues when the extension signs in.
- **Your settings:** whether the extension is switched on.
- **Recent imports:** the title and a link for the last five models you imported through the
  extension, shown in its toolbar popup. This list is kept in your browser's sync storage, so it
  appears in the extension on your other browsers and devices where you're signed in to the same
  browser account and have sync on. It travels through your browser vendor's sync service (Google,
  Mozilla or Microsoft) under that service's own privacy terms. It doesn't include your email or
  password: entries are tied to your Thingport account by a one-way hash of your instance address
  and email. Each model's thumbnail is fetched from your Thingport instance and kept in local
  storage on each device; it isn't synced.
- **Collection import progress:** while a MakerWorld collection import is running, the list of
  model pages still to visit, so it can carry on across page loads. It's deleted when the import
  ends.

## What the extension sends, and where

The extension only communicates with **your Thingport instance** (the address you entered) and with
the **provider site you're on**.

**To your Thingport instance:**

- Your email and password, to sign in.
- The address of each model page you open on MakerWorld, Printables or Thingiverse, to check
  whether you've already imported that model. This happens when the page opens, so the extension
  knows whether to show its button. On a MakerWorld collection page, the same check runs for each
  model in the collection when you open the extension's panel there.
- The address of whatever you import, and your choice of collection, when you import it.
- On a collection or Thingiverse Likes page, when you open the extension's panel: the page's address, to check whether
  that collection is synced. When you turn sync on: the collection's name and the ids of the models
  listed in it, so your instance knows which models are new later.
- A request for the slicer picked in your Thingport Configuration, when a MakerWorld model page opens, so
  the extension knows whether to show its **Download normalized** button.
- If you're logged into MakerWorld in this browser: your MakerWorld session cookie, when you import
  from MakerWorld. MakerWorld requires it to download files. The extension also saves it to your
  Thingport account's MakerWorld setting, so imports made from Thingport's own web app work too.

**To MakerWorld, Printables and Thingiverse:**

- On MakerWorld, to find a model's download link, the extension asks MakerWorld's own website for
  it, the same way the page does when you click Download, using your existing MakerWorld session.
  It may also click the page's own Download button and read the link from the download that
  starts; that download is cancelled and removed from your download history straight away, so no
  file is saved.
- When you click **Download normalized** on a MakerWorld model page, the extension downloads that
  model's file from MakerWorld, as the page's own Download button would, converts it inside your
  browser and saves the result to your downloads. The file isn't sent anywhere else.
- On a MakerWorld collection import, the extension moves your tab from one model page to the next,
  just as if you were clicking through them.

**The extension reads, on supported pages only:** the model's title, MakerWorld's page data for the
model, and the model links listed on collection pages. It doesn't read any other websites.

## What the extension doesn't do

- No analytics, tracking, telemetry or crash reporting.
- No advertising.
- No data sent to the extension's developer, or to any third party.
- No selling or sharing of data.
- No code downloaded from the internet: everything the extension runs is included in it.

## Permissions

| Permission                                       | Why                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Storage                                          | Keeps the settings and data listed under "What the extension stores".                          |
| Cookies                                          | Reads MakerWorld's session cookie, only on makerworld.com, for MakerWorld imports.             |
| Downloads                                        | Reads the link from the MakerWorld download it starts, then cancels and removes that download. |
| Access to MakerWorld, Printables and Thingiverse | Shows the import button, and MakerWorld's Download normalized button, on their pages.          |
| Access to your Thingport instance                | Requested for that one address when you set the extension up, so it can talk to your instance. |

## Your control over your data

- Change your Thingport connection, or switch the extension off, from its toolbar popup.
- Uninstalling the extension deletes everything it stored on that device. The synced list of recent
  imports can stay in your browser account's sync data while the extension is still installed on
  another of your browsers; clearing your browser's synced data removes it.
- Anything the extension sends to your Thingport instance is stored on your own server, under your
  control, like everything else in your Thingport library.

## Changes

If this policy changes, the updated version is published here with a new effective date. Every
past version is in the project's
[git history](https://github.com/TautvydasDerzinskas/Thingport/commits/main/extension/PRIVACY.md).

## Contact

Questions about this policy or the extension:
[open an issue on GitHub](https://github.com/TautvydasDerzinskas/Thingport/issues).
