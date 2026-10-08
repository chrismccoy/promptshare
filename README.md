# Prompt Share

Prompt Share is a small web app for sharing AI prompts through a short link. Anyone can paste or upload a prompt, pick how long it should last, and get a link to send to others. A single administrator signs in to a private dashboard to search, create, edit, and delete shared prompts.

## Admin Tools

- Sign in to a private admin area with a username and password set by the site owner.
- See summary counts of all prompts, prompts created today, prompts expiring in the next 24 hours, and expired prompts.
- Browse all prompts in a table showing a short preview, size, time left, where it came from, and the date it was created.
- Move through long lists 20 prompts at a time with next and previous page links.
- Create new prompts from the dashboard, including prompts that never expire.
- Edit any prompt's text and see its key, created date, edited date, size, source, and status beside the editor.
- Change a prompt's expiry while editing: keep the current one, pick a new length, make it never expire, or expire it right away.
- Load a .txt or .md file into the editor instead of typing.
- See a live size and character count in the editor that turns red when the prompt is too large.
- Copy the share link of a newly created prompt from the confirmation message.
- Open, view as plain text, or edit any prompt straight from its row.
- Delete a single prompt with a confirm step and a cancel option.
- Select several prompts, or a whole page at once, and delete up to 100 of them together after confirming.
- Watch the counts and table update right away after deleting, without reloading the page.
- Jump to the public site in a new tab or log out from the side menu.

## Sharing Prompts

- Paste a prompt into a text box and share it with one click.
- Upload a .txt or .md file by choosing it or dragging it onto the page, with a preview of its contents before sharing.
- Switch between the paste and upload views using tabs at the top of the page.
- Choose whether a shared prompt lasts 1 day, 7 days, 30 days, or 1 year, with 7 days selected by default.
- See the size and character count of your prompt update as you type or load a file.
- Get a short, hard to guess link once the prompt is shared, with a button to copy it.
- Clear the box and start over with a Clear button.
- Get a short on screen message when a prompt is shared, copied, too large, or fails to send.
- Share prompts even with JavaScript turned off in your browser, using the paste box only.

## Security and Privacy

- Expired prompts are removed automatically every hour, and right away when someone opens an expired link.
- Shared prompt pages and admin pages are hidden from search engines.
- Admin pages are never stored in the browser cache.
- Limits each visitor to 20 new shared prompts every 15 minutes to prevent abuse.
- Limits sign in attempts to 10 every 15 minutes to protect the admin account from guessing.
- Keeps the administrator signed in for up to 7 days of activity, then asks them to sign in again.
- Sends the administrator back to the sign in page if their session ends while working.
- Protects every form from being submitted by other websites.
- Rejects prompts that are empty, are not plain text, or are larger than the allowed size.

## Viewing Shared Prompts

- Open a shared link to read the full prompt in a clean, scrollable view.
- Copy the whole prompt to your clipboard with one button.
- Open a plain text version of the prompt in a new tab using the Raw button.
- See how large the prompt is and how many characters it has.
- See when the prompt expires and how many days are left.
- See the date a prompt was last edited when an administrator has changed it.
- See a clear message when a link does not exist or the prompt has expired.

## Search and Filtering

- Search prompts in the dashboard by their link key or by any words in their text.
- Filter the list to show all, active, or expired prompts.
- Filter the list by source to show prompts shared by the public or created by the administrator.
- See the list update as soon as a status or source filter is changed.
- See a "No results" message with a button to clear filters when nothing matches.
- See a "No prompts yet" message with a shortcut to create one when the list is empty.

## Settings for Site Owners

- Set the largest allowed prompt size, 1 MB by default, which applies to pasted text, uploaded files, and admin edits.
- Choose whether the paste or upload tab opens first on the share page.
- Choose the time zone used for dates on share and admin pages.
- Set the administrator's username and password.
