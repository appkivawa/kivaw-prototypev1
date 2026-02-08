-- Seed default RSS sources for Kivaw
-- This migration inserts ~100 RSS sources across Tech, Culture, Finance, and Music categories
-- Uses UPSERT to prevent duplicates on re-runs

INSERT INTO public.rss_sources (title, url, category, weight, language, active)
VALUES
  -- ============================================================
  -- TECH: AI, Startups, Engineering
  -- ============================================================
  ('Hacker News', 'https://hnrss.org/frontpage', 'tech', 5, 'en', true),
  ('TechCrunch', 'https://techcrunch.com/feed/', 'tech', 5, 'en', true),
  ('The Verge', 'https://www.theverge.com/rss/index.xml', 'tech', 5, 'en', true),
  ('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'tech', 4, 'en', true),
  ('Wired', 'https://www.wired.com/feed/rss', 'tech', 4, 'en', true),
  ('IEEE Spectrum', 'https://spectrum.ieee.org/rss', 'tech', 4, 'en', true),
  ('MIT Technology Review', 'https://www.technologyreview.com/feed/', 'tech', 4, 'en', true),
  ('The Information', 'https://www.theinformation.com/feed', 'tech', 5, 'en', true),
  ('Stratechery', 'https://stratechery.com/feed/', 'tech', 5, 'en', true),
  ('Benedict Evans', 'https://www.ben-evans.com/newsletter/feed', 'tech', 4, 'en', true),
  ('Paul Graham Essays', 'http://www.aaronsw.com/2002/feeds/pgessays.rss', 'tech', 4, 'en', true),
  ('Y Combinator', 'https://blog.ycombinator.com/feed/', 'tech', 5, 'en', true),
  ('First Round Review', 'https://firstround.com/review/feed/', 'tech', 4, 'en', true),
  ('Andreessen Horowitz', 'https://a16z.com/feed/', 'tech', 5, 'en', true),
  ('Not Boring', 'https://www.notboring.co/feed', 'tech', 4, 'en', true),
  ('Platformer', 'https://www.platformer.news/feed', 'tech', 4, 'en', true),
  ('The Generalist', 'https://www.readthegeneralist.com/feed', 'tech', 4, 'en', true),
  ('Lenny''s Newsletter', 'https://www.lennysnewsletter.com/feed', 'tech', 4, 'en', true),
  ('Wait But Why', 'https://waitbutwhy.com/feed', 'tech', 3, 'en', true),
  ('The Diff', 'https://www.readthediff.com/feed', 'tech', 4, 'en', true),
  ('Interconnected', 'https://interconnected.org/home/feed', 'tech', 3, 'en', true),
  ('Daring Fireball', 'https://daringfireball.net/feeds/main', 'tech', 4, 'en', true),
  ('Six Colors', 'https://sixcolors.com/feed/', 'tech', 3, 'en', true),
  ('MacStories', 'https://www.macstories.net/feed/', 'tech', 3, 'en', true),
  ('The Overshoot', 'https://theovershoot.co/feed', 'tech', 3, 'en', true),
  ('AI News', 'https://www.artificialintelligence-news.com/feed/', 'tech', 4, 'en', true),
  ('The Batch (DeepLearning.AI)', 'https://www.deeplearning.ai/the-batch/feed/', 'tech', 4, 'en', true),
  ('OpenAI Blog', 'https://openai.com/blog/rss.xml', 'tech', 5, 'en', true),
  ('Anthropic Blog', 'https://www.anthropic.com/index.xml', 'tech', 5, 'en', true),
  ('Google AI Blog', 'https://ai.googleblog.com/feeds/posts/default', 'tech', 4, 'en', true),
  ('Fast.ai', 'https://www.fast.ai/atom.xml', 'tech', 4, 'en', true),
  ('Distill', 'https://distill.pub/rss.xml', 'tech', 4, 'en', true),
  
  -- ============================================================
  -- CULTURE: Film/TV, Internet Culture
  -- ============================================================
  ('Polygon', 'https://www.polygon.com/rss/index.xml', 'culture', 4, 'en', true),
  ('The A.V. Club', 'https://www.avclub.com/rss', 'culture', 4, 'en', true),
  ('Vulture', 'https://www.vulture.com/feeds/all/rss.xml', 'culture', 4, 'en', true),
  ('IndieWire', 'https://www.indiewire.com/feed/', 'culture', 4, 'en', true),
  ('Variety', 'https://variety.com/feed/', 'culture', 5, 'en', true),
  ('The Hollywood Reporter', 'https://www.hollywoodreporter.com/feed/', 'culture', 5, 'en', true),
  ('Deadline', 'https://deadline.com/feed/', 'culture', 5, 'en', true),
  ('Entertainment Weekly', 'https://ew.com/feed/', 'culture', 4, 'en', true),
  ('Rolling Stone', 'https://www.rollingstone.com/feed/', 'culture', 5, 'en', true),
  ('The Ringer', 'https://www.theringer.com/rss/index.xml', 'culture', 4, 'en', true),
  ('Vox Culture', 'https://www.vox.com/rss/culture/index.xml', 'culture', 4, 'en', true),
  ('The Atlantic Culture', 'https://www.theatlantic.com/feed/all/', 'culture', 4, 'en', true),
  ('New Yorker Culture', 'https://www.newyorker.com/feed/culture', 'culture', 5, 'en', true),
  ('The Guardian Film', 'https://www.theguardian.com/film/rss', 'culture', 4, 'en', true),
  ('The Guardian TV', 'https://www.theguardian.com/tv-and-radio/rss', 'culture', 4, 'en', true),
  ('BBC Culture', 'https://www.bbc.com/culture/feed', 'culture', 4, 'en', true),
  ('NPR Pop Culture', 'https://www.npr.org/rss/rss.php?id=1045', 'culture', 4, 'en', true),
  ('Know Your Meme', 'https://knowyourmeme.com/news.rss', 'culture', 3, 'en', true),
  ('The Awl', 'https://www.theawl.com/feed/', 'culture', 3, 'en', true),
  ('The Toast', 'https://the-toast.net/feed/', 'culture', 3, 'en', true),
  ('Hazlitt', 'https://hazlitt.net/feed', 'culture', 3, 'en', true),
  ('Longreads', 'https://longreads.com/feed/', 'culture', 4, 'en', true),
  ('The Paris Review', 'https://www.theparisreview.org/feed', 'culture', 4, 'en', true),
  ('Literary Hub', 'https://lithub.com/feed/', 'culture', 4, 'en', true),
  ('Electric Literature', 'https://electricliterature.com/feed/', 'culture', 3, 'en', true),
  ('The Millions', 'https://themillions.com/feed', 'culture', 3, 'en', true),
  ('Book Riot', 'https://bookriot.com/feed/', 'culture', 3, 'en', true),
  ('Tor.com', 'https://www.tor.com/feed/', 'culture', 3, 'en', true),
  ('io9', 'https://gizmodo.com/io9/rss', 'culture', 4, 'en', true),
  ('Gizmodo', 'https://gizmodo.com/rss', 'culture', 4, 'en', true),
  ('Kotaku', 'https://kotaku.com/rss', 'culture', 4, 'en', true),
  ('Jezebel', 'https://jezebel.com/rss', 'culture', 3, 'en', true),
  ('Lifehacker', 'https://lifehacker.com/rss', 'culture', 3, 'en', true),
  
  -- ============================================================
  -- FINANCE: Markets, Macro, VC
  -- ============================================================
  ('Financial Times', 'https://www.ft.com/?format=rss', 'finance', 5, 'en', true),
  ('Bloomberg', 'https://www.bloomberg.com/feed/topics/technology', 'finance', 5, 'en', true),
  ('Wall Street Journal', 'https://www.wsj.com/xml/rss/3_7085.xml', 'finance', 5, 'en', true),
  ('Reuters Business', 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best', 'finance', 5, 'en', true),
  ('The Economist', 'https://www.economist.com/finance-and-economics/rss.xml', 'finance', 5, 'en', true),
  ('Barron''s', 'https://www.barrons.com/feeds/articles', 'finance', 4, 'en', true),
  ('MarketWatch', 'https://www.marketwatch.com/rss/topstories', 'finance', 4, 'en', true),
  ('CNBC', 'https://www.cnbc.com/id/100003114/device/rss/rss.html', 'finance', 5, 'en', true),
  ('Yahoo Finance', 'https://finance.yahoo.com/news/rssindex', 'finance', 4, 'en', true),
  ('Seeking Alpha', 'https://seekingalpha.com/feed.xml', 'finance', 4, 'en', true),
  ('Zero Hedge', 'https://www.zerohedge.com/fullrss2.xml', 'finance', 3, 'en', true),
  ('Calculated Risk', 'https://www.calculatedriskblog.com/feeds/posts/default', 'finance', 4, 'en', true),
  ('Marginal Revolution', 'https://marginalrevolution.com/feed', 'finance', 4, 'en', true),
  ('Naked Capitalism', 'https://www.nakedcapitalism.com/feed', 'finance', 3, 'en', true),
  ('The Big Picture', 'https://ritholtz.com/feed/', 'finance', 4, 'en', true),
  ('A Wealth of Common Sense', 'https://awealthofcommonsense.com/feed/', 'finance', 3, 'en', true),
  ('Abnormal Returns', 'https://abnormalreturns.com/feed/', 'finance', 3, 'en', true),
  ('Above the Market', 'https://abovethemarket.com/feed/', 'finance', 3, 'en', true),
  ('The Reformed Broker', 'https://thereformedbroker.com/feed/', 'finance', 3, 'en', true),
  ('Felix Salmon', 'https://www.axios.com/feeds/felix-salmon.rss', 'finance', 4, 'en', true),
  ('Matt Levine (Bloomberg)', 'https://www.bloomberg.com/opinion/authors/ARbTQlRLRjE/matthew-s-levine/rss', 'finance', 5, 'en', true),
  ('John Authers (Bloomberg)', 'https://www.bloomberg.com/opinion/authors/ARQvJNlRqjE/john-authers/rss', 'finance', 4, 'en', true),
  ('VC News', 'https://techcrunch.com/tag/venture-capital/feed/', 'finance', 4, 'en', true),
  ('Crunchbase News', 'https://news.crunchbase.com/feed/', 'finance', 4, 'en', true),
  ('PitchBook News', 'https://pitchbook.com/news/articles/feed', 'finance', 4, 'en', true),
  ('CB Insights', 'https://www.cbinsights.com/research/feed', 'finance', 4, 'en', true),
  ('NFX Signal', 'https://www.nfx.com/signal/feed/', 'finance', 3, 'en', true),
  ('Bessemer Cloud', 'https://www.bvp.com/atlas/feed', 'finance', 4, 'en', true),
  ('Index Ventures', 'https://www.indexventures.com/feed', 'finance', 4, 'en', true),
  ('Lightspeed', 'https://lsvp.com/feed/', 'finance', 3, 'en', true),
  ('Union Square Ventures', 'https://www.usv.com/writing/feed', 'finance', 3, 'en', true),
  ('Sequoia Capital', 'https://www.sequoiacap.com/feed/', 'finance', 5, 'en', true),
  ('Accel', 'https://www.accel.com/feed', 'finance', 4, 'en', true),
  ('Benchmark', 'https://www.benchmark.com/feed/', 'finance', 4, 'en', true),
  ('Greylock', 'https://greylock.com/feed/', 'finance', 4, 'en', true),
  
  -- ============================================================
  -- MUSIC: Music News, Reviews
  -- ============================================================
  ('Pitchfork', 'https://pitchfork.com/feed/', 'music', 5, 'en', true),
  ('Rolling Stone Music', 'https://www.rollingstone.com/music/feed/', 'music', 5, 'en', true),
  ('NME', 'https://www.nme.com/feed', 'music', 4, 'en', true),
  ('Stereogum', 'https://www.stereogum.com/feed/', 'music', 4, 'en', true),
  ('Consequence', 'https://consequence.net/feed/', 'music', 4, 'en', true),
  ('The Fader', 'https://www.thefader.com/feed', 'music', 4, 'en', true),
  ('Spin', 'https://www.spin.com/feed/', 'music', 4, 'en', true),
  ('Billboard', 'https://www.billboard.com/feed/', 'music', 5, 'en', true),
  ('Variety Music', 'https://variety.com/music/feed/', 'music', 4, 'en', true),
  ('NPR Music', 'https://www.npr.org/rss/rss.php?id=1001', 'music', 4, 'en', true),
  ('The Guardian Music', 'https://www.theguardian.com/music/rss', 'music', 4, 'en', true),
  ('BBC Music', 'https://www.bbc.com/music/feed', 'music', 4, 'en', true),
  ('AllMusic', 'https://www.allmusic.com/rss', 'music', 3, 'en', true),
  ('Tiny Mix Tapes', 'https://www.tinymixtapes.com/feed', 'music', 3, 'en', true),
  ('Brooklyn Vegan', 'https://www.brooklynvegan.com/feed/', 'music', 3, 'en', true),
  ('Gorilla vs Bear', 'https://gorillavsbear.net/feed/', 'music', 3, 'en', true),
  ('Aquarium Drunkard', 'https://www.aquariumdrunkard.com/feed/', 'music', 3, 'en', true),
  ('Bandcamp Daily', 'https://daily.bandcamp.com/feed', 'music', 3, 'en', true),
  ('Resident Advisor', 'https://ra.co/xml/rss.xml', 'music', 3, 'en', true),
  ('Mixmag', 'https://mixmag.net/feed', 'music', 3, 'en', true),
  ('DJ Mag', 'https://djmag.com/feed', 'music', 3, 'en', true),
  ('The Quietus', 'https://thequietus.com/feed', 'music', 3, 'en', true),
  ('Wire Magazine', 'https://www.thewire.co.uk/rss', 'music', 3, 'en', true),
  ('JazzTimes', 'https://jazztimes.com/feed/', 'music', 3, 'en', true),
  ('DownBeat', 'https://downbeat.com/feed/', 'music', 3, 'en', true),
  ('Classic FM', 'https://www.classicfm.com/feed/', 'music', 3, 'en', true),
  ('Gramophone', 'https://www.gramophone.co.uk/feed', 'music', 3, 'en', true)
ON CONFLICT (url) 
DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  weight = EXCLUDED.weight,
  language = EXCLUDED.language,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Verify the seed
SELECT 
  category,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE active = true) as active_count
FROM public.rss_sources
GROUP BY category
ORDER BY category;

