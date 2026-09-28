# Thingport Grab privacy policy

_Effective 27 September 2026._

Thingport Grab is a browser extension that imports 3D-printing models from MakerWorld, Printables
and Thingiverse into **your own self-hosted Thingport instance**. It has no servers of its own: the
extension's developer never receives any of your data, and nothing is shared with anyone else.

## What the extension stores

Everything below is kept in your browser's local extension storage, on your device only. It isn't
synced between browsers or devices.

- **Your Thingport connection:** the address of your Thingport instance, and the email and password
  you sign in to it with. They're stored as you entered them, so the extension can sign in again
  when its session expires.
- **A session token** your Thingport instance issues when the extension signs in.
- **Your settings:** whether the extension is switched on.
- **Recent imports:** the title, a small thumbnail and a link for the last five models you imported
  through the extension, shown in its toolbar popup.
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
- If you're logged into MakerWorld in this browser: your MakerWorld session cookie, when you import
  from MakerWorld. MakerWorld requires it to download files. The extension also saves it to your
  Thingport account's MakerWorld setting, so imports made from Thingport's own web app work too.

**To MakerWorld, Printables and Thingiverse:**

- On MakerWorld, to find a model's download link, the extension asks MakerWorld's own website for
  it, the same way the page does when you click Download, using your existing MakerWorld session.
  It may also click the page's own Download button and read the link from the download that
  starts; that download is cancelled and removed from your download history straight away, so no
  file is saved.
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

| Permission                                       | Why                                                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Storage                                          | Keeps the settings and data listed under "What the extension stores".                                          |
| Tabs                                             | Opens imported models and the setup form, and moves between model pages during a MakerWorld collection import. |
| Cookies                                          | Reads MakerWorld's session cookie, only on makerworld.com, for MakerWorld imports.                             |
| Downloads                                        | Reads the link from the MakerWorld download it starts, then cancels and removes that download.                 |
| Access to MakerWorld, Printables and Thingiverse | Shows the import button on their pages.                                                                        |
| Access to your Thingport instance                | Requested for that one address when you set the extension up, so it can talk to your instance.                 |

## Your control over your data

- Change your Thingport connection, or switch the extension off, from its toolbar popup.
- Uninstalling the extension deletes everything it stored.
- Anything the extension sends to your Thingport instance is stored on your own server, under your
  control, like everything else in your Thingport library.

## Changes

If this policy changes, the updated version is published here with a new effective date. Every
past version is in the project's
[git history](https://github.com/TautvydasDerzinskas/Thingport/commits/main/extension/PRIVACY.md).

## Contact

Questions about this policy or the extension:
[open an issue on GitHub](https://github.com/TautvydasDerzinskas/Thingport/issues).
