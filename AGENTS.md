<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Banner fixtures come only from the ntfut feed via authenticated server functions; crests are converted to data URLs server-side from an allowlisted host so canvas export stays safe. API-Football code is legacy and unused.
- Fetch fixtures per saved competition (date+league+season), not per team, to minimize API quota use.
- Store favorites and query caches per user under RLS; cache successful empty fixtures too to avoid spending quota on repeat empty searches.
- Convert provider team crests to bounded data URLs server-side with a fixed host/path allowlist so canvas exports remain safe without cross-origin dependencies.
- Keep automatic fixture import in the banner feature; merge by provider fixture ID and retain manually entered channels and games.
