# Connect an AI assistant with MCP

Thingport speaks the [Model Context Protocol](https://modelcontextprotocol.io), so an AI assistant such as Claude Code
can search and read your library for you: "which of my models are articulated dragons?", "what's in my Printer
upgrades collection?", "what did I import from Printables this month?".

It's built into the backend, so there's nothing extra to install or run. The endpoint is `/api/mcp` on the same address
you open Thingport at, and the assistant signs in with your [API token](api-token.md).

## 1. Generate a token and pick its tools

1. Open the user menu (your avatar, top right) and choose **Profile**.
2. Next to **API token**, click **Generate**, and copy the token straight away: it's shown only once.
3. Under **MCP tools**, untick anything you don't want the assistant to use. Changes apply at once, to the token you
   already have.

A new token gets every tool that only reads. The token still can't change anything over the REST API, and an MCP tool
is only reachable if it's ticked here.

## 2. Add Thingport to your assistant

Right after you generate the token, the profile shows the command with your address and token already filled in. For
[Claude Code](https://claude.com/claude-code) it looks like this:

```bash
claude mcp add --transport http thingport https://thingport.example.com/api/mcp \
  --header "Authorization: Bearer tp_your_token_here"
```

Any other MCP client works the same way, as long as it supports the Streamable HTTP transport and lets you set a
header: point it at `https://thingport.example.com/api/mcp` and send `Authorization: Bearer tp_...`.

The token works only in that header. Putting it in the address as `?token=...` is refused.

## The tools

| Tool               | What it does                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `search_models`    | Finds models by words in their title, tags, creator or description, plus matching collections and tags. |
| `list_models`      | Lists models by tag, category, collection or author, newest, most viewed or most printed first.         |
| `get_model`        | One model's description, files, tags, category, author, collections and where it was imported from.     |
| `list_collections` | Your collections and how many models each holds, plus Favourites and Browsing History.                  |
| `get_collection`   | The models in one collection.                                                                           |
| `list_tags`        | Every tag in your library.                                                                              |
| `list_categories`  | Your category and folder tree.                                                                          |
| `get_author`       | A designer, where to find them, and their models in your library.                                       |
| `library_stats`    | Your totals, and your most viewed, most printed and newest models.                                      |

Every tool sees only your own library, exactly as you do in Thingport. Looking a model up through MCP doesn't count as a
view, so it doesn't change your Browsing History or your most viewed models.

If your instance has a public address set (`PUBLIC_URL`), models come back with a link to their page in Thingport, so
the assistant can hand you one.

## Turn it off

- **Untick tools** on your Profile to take them away from the assistant without replacing the token.
- **Revoke** the token to cut the assistant off altogether. Anything else using the same token loses access too.
