-- =============================================================================
-- Demo workspace sample content (Flyway repeatable migration: defines a function only).
--
-- bloom_seed_demo_content(ws) fills a DEMO workspace with clearly synthetic planning data:
-- tasks, daily plans and notes, goals, content ideas/drafts/versions, brands, campaigns,
-- deliverables and payment records. It is called by DemoWorkspaceSeeder after the demo
-- accounts have synced, so analytics-linked goals can point at real demo snapshots.
-- It refuses to run against a non-demo workspace. Dates are relative to current_date.
-- =============================================================================
CREATE OR REPLACE FUNCTION bloom_seed_demo_content(ws uuid) RETURNS integer
LANGUAGE plpgsql AS
$$
DECLARE
    today        constant date := current_date;
    ig_account   uuid;
    ig_start     numeric;
    g_followers  uuid := gen_random_uuid();
    g_videos     uuid := gen_random_uuid();
    g_revenue    uuid := gen_random_uuid();
    g_course     uuid := gen_random_uuid();
    g_newsletter uuid := gen_random_uuid();
    b_terra      uuid := gen_random_uuid();
    b_greenhouse uuid := gen_random_uuid();
    b_seedling   uuid := gen_random_uuid();
    b_loam       uuid := gen_random_uuid();
    b_rain       uuid := gen_random_uuid();
    c_paid       uuid := gen_random_uuid();
    c_delivered  uuid := gen_random_uuid();
    c_progress   uuid := gen_random_uuid();
    c_confirmed  uuid := gen_random_uuid();
    i_allotment  uuid := gen_random_uuid();
    d_border     uuid := gen_random_uuid();
    d_herbs      uuid := gen_random_uuid();
    d_unboxing   uuid := gen_random_uuid();
    d_soil       uuid := gen_random_uuid();
    t_review     uuid := gen_random_uuid();
    t_reel       uuid := gen_random_uuid();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM workspace WHERE id = ws AND is_demo) THEN
        RAISE EXCEPTION 'bloom_seed_demo_content only seeds a demo workspace';
    END IF;

    SELECT id INTO ig_account FROM connected_social_account
    WHERE workspace_id = ws AND provider = 'INSTAGRAM' AND connection_status = 'ACTIVE'
    ORDER BY created_at LIMIT 1;

    SELECT value INTO ig_start FROM analytics_snapshot
    WHERE account_id = ig_account AND metric_key = 'instagram.followers_count'
      AND time_window = 'DAY' AND dimension_key = '' AND snapshot_date <= today - 90
    ORDER BY snapshot_date DESC LIMIT 1;

    -- ------------------------------------------------------------------ goals
    INSERT INTO goal (id, workspace_id, title, category, description, unit, start_value, target_value, current_value,
                      start_date, deadline, progress_source, linked_account_id, linked_metric_key, status, completed_at)
    VALUES
        (g_videos, ws, 'Publish 24 long-form videos this year', 'CONTENT', 'Two in-depth guides per month.',
         'videos', 0, 24, 10, today - 200, today + 165, 'MANUAL', NULL, NULL, 'ACTIVE', NULL),
        (g_revenue, ws, 'Earn $15,000 from brand partnerships', 'REVENUE', 'Favour long-term partners over one-off posts.',
         'USD', 0, 15000, 6150, today - 150, today + 30, 'MANUAL', NULL, NULL, 'ACTIVE', NULL),
        (g_course, ws, 'Finish the colour grading course', 'SKILL', 'Eight modules, one per week.',
         'modules', 0, 8, 8, today - 70, today - 10, 'MANUAL', NULL, NULL, 'COMPLETED', now() - interval '12 days'),
        (g_newsletter, ws, 'Launch the seasonal newsletter', 'PERSONAL', 'Landing page, first issue and welcome email.',
         '%', 0, 100, 60, today - 60, today - 5, 'MANUAL', NULL, NULL, 'ACTIVE', NULL);

    IF ig_account IS NOT NULL THEN
        INSERT INTO goal (id, workspace_id, title, category, description, unit, start_value, target_value, current_value,
                          start_date, deadline, progress_source, linked_account_id, linked_metric_key, status)
        VALUES (g_followers, ws, 'Grow Instagram by 4,000 followers', 'AUDIENCE',
                'Weekly Reels plus two carousel guides a month. Progress comes from synced follower counts.',
                'followers', coalesce(ig_start, 15000), coalesce(ig_start, 15000) + 4000, coalesce(ig_start, 15000),
                today - 90, today + 45, 'ANALYTICS', ig_account, 'instagram.followers_count', 'ACTIVE');
        INSERT INTO goal_milestone (id, goal_id, title, target_value, due_date, achieved_at, position) VALUES
            (gen_random_uuid(), g_followers, '+2,000 followers', coalesce(ig_start, 15000) + 2000, today - 10, NULL, 0),
            (gen_random_uuid(), g_followers, '+4,000 followers', coalesce(ig_start, 15000) + 4000, today + 45, NULL, 1);
    END IF;

    INSERT INTO goal_milestone (id, goal_id, title, target_value, due_date, achieved_at, position) VALUES
        (gen_random_uuid(), g_videos, 'Q1 batch (6 videos)', 6, today - 110, now() - interval '112 days', 0),
        (gen_random_uuid(), g_videos, 'Q2 batch (12 videos)', 12, today - 20, NULL, 1),
        (gen_random_uuid(), g_newsletter, 'Landing page live', NULL, today - 30, now() - interval '28 days', 0),
        (gen_random_uuid(), g_newsletter, 'First issue sent', NULL, today - 5, NULL, 1);

    INSERT INTO goal_progress_entry (id, goal_id, value, source, note, recorded_at) VALUES
        (gen_random_uuid(), g_videos, 2, 'MANUAL', 'January batch', now() - interval '180 days'),
        (gen_random_uuid(), g_videos, 5, 'MANUAL', NULL, now() - interval '130 days'),
        (gen_random_uuid(), g_videos, 7, 'MANUAL', NULL, now() - interval '90 days'),
        (gen_random_uuid(), g_videos, 9, 'MANUAL', 'Composting series published', now() - interval '40 days'),
        (gen_random_uuid(), g_videos, 10, 'MANUAL', NULL, now() - interval '6 days'),
        (gen_random_uuid(), g_revenue, 1800, 'MANUAL', 'Terra Tools paid', now() - interval '120 days'),
        (gen_random_uuid(), g_revenue, 4300, 'MANUAL', NULL, now() - interval '60 days'),
        (gen_random_uuid(), g_revenue, 6150, 'MANUAL', 'Greenhouse Co. instalment', now() - interval '12 days'),
        (gen_random_uuid(), g_course, 1, 'MANUAL', NULL, now() - interval '63 days'),
        (gen_random_uuid(), g_course, 5, 'MANUAL', NULL, now() - interval '35 days'),
        (gen_random_uuid(), g_course, 8, 'MANUAL', 'Course complete', now() - interval '12 days'),
        (gen_random_uuid(), g_newsletter, 35, 'MANUAL', 'Landing page live', now() - interval '30 days'),
        (gen_random_uuid(), g_newsletter, 60, 'MANUAL', 'First issue drafted', now() - interval '9 days');

    -- ----------------------------------------------------------------- brands
    INSERT INTO brand_contact (id, workspace_id, brand_name, contact_name, email, website, notes) VALUES
        (b_terra, ws, 'Terra Tools (demo)', 'Maya Okafor', 'maya@terratools.example', 'https://terratools.example', 'Hand tools. Prefers tutorial Reels.'),
        (b_greenhouse, ws, 'Greenhouse Co. (demo)', 'Jonas Berg', 'jonas@greenhouse.example', 'https://greenhouse.example', 'Long-term partner; quarterly campaigns.'),
        (b_seedling, ws, 'Seedling Supply (demo)', 'Priya Nair', 'priya@seedling.example', NULL, NULL),
        (b_loam, ws, 'Loam Studio (demo)', 'Theo Marsh', 'theo@loam.example', 'https://loam.example', 'Ceramic planters, EU based. Invoices in EUR.'),
        (b_rain, ws, 'Rainwater Labs (demo)', NULL, 'hello@rainwater.example', NULL, 'Inbound lead from the website form.');

    INSERT INTO campaign (id, workspace_id, brand_contact_id, name, stage, agreed_amount, currency, start_date, end_date, notes) VALUES
        (c_paid, ws, b_terra, 'Spring tool care series', 'PAID', 1800.00, 'USD', today - 160, today - 130, NULL),
        (c_delivered, ws, b_greenhouse, 'Greenhouse winter set-up', 'DELIVERED', 4350.00, 'USD', today - 45, today - 8, 'Second instalment due on sign-off.'),
        (c_progress, ws, b_loam, 'Planter launch (EU)', 'IN_PROGRESS', 2200.00, 'EUR', today - 10, today + 20, NULL),
        (c_confirmed, ws, b_greenhouse, 'Greenhouse spring Reels', 'CONFIRMED', 3600.00, 'USD', today + 20, today + 50, '2 Reels + 1 Story set.'),
        (gen_random_uuid(), ws, b_seedling, 'Seed starting guide sponsorship', 'NEGOTIATING', 1500.00, 'USD', NULL, NULL, 'Countered at 1,500; waiting on reply.'),
        (gen_random_uuid(), ws, b_rain, 'Rain barrel review', 'LEAD', NULL, 'USD', NULL, NULL, NULL),
        (gen_random_uuid(), ws, b_terra, 'Autumn pruning tips', 'CONTACTED', NULL, 'USD', NULL, NULL, 'Sent media kit.');

    INSERT INTO payment_record (id, campaign_id, amount, currency, invoice_reference, invoiced_date, due_date, paid_date, note) VALUES
        (gen_random_uuid(), c_paid, 1800.00, 'USD', 'INV-2041', today - 130, today - 116, today - 120, NULL),
        (gen_random_uuid(), c_delivered, 2500.00, 'USD', 'INV-2057-A', today - 70, today - 56, today - 60, 'First instalment'),
        (gen_random_uuid(), c_delivered, 1850.00, 'USD', 'INV-2057-B', today - 8, today + 6, NULL, 'Second instalment'),
        (gen_random_uuid(), c_progress, 1100.00, 'EUR', 'LOAM-PO-77', today - 12, today - 2, NULL, '50% upfront — overdue');

    -- ---------------------------------------------------------------- content
    INSERT INTO content_idea (id, workspace_id, title, notes, platform, tags, status) VALUES
        (i_allotment, ws, 'First-year allotment diary', 'Monthly check-ins; possible seed library collab.', 'YOUTUBE', '{series,allotment}', 'PROMOTED'),
        (gen_random_uuid(), ws, 'Herb pairing cheat sheet', 'Carousel, 8 slides.', 'INSTAGRAM', '{carousel,herbs}', 'OPEN'),
        (gen_random_uuid(), ws, 'What I would plant in a 1m² bed', NULL, 'TIKTOK', '{small-space}', 'OPEN'),
        (gen_random_uuid(), ws, 'Studio Q&A: tools I actually use', NULL, NULL, '{community}', 'OPEN'),
        (gen_random_uuid(), ws, 'Rain barrel install timelapse', 'Possible Rainwater Labs tie-in.', 'TIKTOK', '{diy}', 'OPEN');

    INSERT INTO content_draft (id, workspace_id, idea_id, parent_draft_id, title, platform, content_type, caption, script,
                               hashtags, notes, planned_date, stage, goal_id, campaign_id, published_at, published_url,
                               publication_source, current_version)
    VALUES
        (d_border, ws, NULL, NULL, 'Designing a pollinator border from scratch', 'YOUTUBE', 'VIDEO',
         'A step-by-step plan for a border that feeds bees from March to October.',
         E'INTRO\nWhy pollinator borders fail in year one.\n\nPART 1 — Site and soil\nPART 2 — Plant list by season\nPART 3 — Maintenance calendar',
         '{pollinators,gardendesign,wildlifegarden}', 'Pull B-roll from the June shoot.', today + 12, 'SCRIPT', g_videos, NULL, NULL, NULL, NULL, 2),
        (d_herbs, ws, NULL, NULL, 'Five cold-hardy herbs for a windowsill', 'INSTAGRAM', 'CAROUSEL', NULL,
         NULL, '{herbs,indoorgarden,smallspace}', NULL, today + 2, 'READY', NULL, NULL, NULL, NULL, NULL, 1),
        (d_unboxing, ws, NULL, NULL, 'Unboxing: Loam planters', 'INSTAGRAM', 'REEL', 'Paid partnership with Loam Studio (demo).',
         'Shot list: box, hands, three planters, final shelf.', '{ad,planters}', 'Disclose the partnership in the first line.',
         today + 5, 'IN_PRODUCTION', NULL, c_progress, NULL, NULL, NULL, 1),
        (gen_random_uuid(), ws, i_allotment, NULL, 'Allotment diary — episode 1', 'YOUTUBE', 'VIDEO', NULL,
         'Cold open on the overgrown plot.', '{allotment}', NULL, today + 20, 'SCRIPT', g_videos, NULL, NULL, NULL, NULL, 1),
        (d_soil, ws, NULL, NULL, '60-second soil test', 'YOUTUBE', 'SHORT', 'The jar test in under a minute.', NULL,
         '{soil,gardeningtips}', NULL, today - 2, 'PUBLISHED', g_videos, NULL, now() - interval '2 days',
         'https://youtube.com/shorts/demo-soil-test', 'MANUAL', 1),
        (gen_random_uuid(), ws, NULL, NULL, 'Spring checklist Reel', 'INSTAGRAM', 'REEL', NULL, 'Ten-item checklist, quick cuts.',
         '{spring,ad}', 'For the Greenhouse Co. campaign.', today + 25, 'SCRIPT', NULL, c_confirmed, NULL, NULL, NULL, 1);

    UPDATE content_draft SET caption = 'Five herbs that keep going when the heating is on and the light is low. Save this for October.'
    WHERE id = d_herbs;

    INSERT INTO content_draft (id, workspace_id, parent_draft_id, title, platform, content_type, stage, caption, hashtags,
                               planned_date, current_version)
    VALUES (gen_random_uuid(), ws, d_herbs, 'Five cold-hardy herbs — TikTok cut', 'TIKTOK', 'VIDEO', 'SCRIPT',
            'Five herbs that survive winter on a windowsill.', '{herbs,indoorgarden}', today + 4, 1);

    -- Version 1 for every draft, plus an earlier outline for the pollinator video.
    INSERT INTO content_version (id, draft_id, version_number, snapshot, change_summary, created_at)
    SELECT gen_random_uuid(), d.id, d.current_version,
           jsonb_build_object('title', d.title, 'caption', d.caption, 'script', d.script,
                              'hashtags', to_jsonb(d.hashtags), 'notes', d.notes),
           CASE WHEN d.parent_draft_id IS NULL THEN 'Created' ELSE 'Repurposed from "Five cold-hardy herbs for a windowsill"' END,
           now() - interval '1 day'
    FROM content_draft d WHERE d.workspace_id = ws;

    INSERT INTO content_version (id, draft_id, version_number, snapshot, change_summary, created_at)
    VALUES (gen_random_uuid(), d_border, 1,
            jsonb_build_object('title', 'Designing a pollinator border', 'caption', 'A plan for a pollinator border.',
                               'script', E'INTRO\nWhy pollinator borders fail.\n\nPART 1 — Site\nPART 2 — Plants',
                               'hashtags', '["pollinators"]'::jsonb, 'notes', NULL),
            'Outline', now() - interval '4 days');

    INSERT INTO deliverable (id, campaign_id, title, platform, due_date, status, content_draft_id) VALUES
        (gen_random_uuid(), c_progress, 'Unboxing Reel', 'INSTAGRAM', today + 5, 'IN_PROGRESS', d_unboxing),
        (gen_random_uuid(), c_progress, 'Styling carousel', 'INSTAGRAM', today + 12, 'PLANNED', NULL),
        (gen_random_uuid(), c_progress, 'YouTube integration (60s)', 'YOUTUBE', today + 18, 'PLANNED', NULL),
        (gen_random_uuid(), c_confirmed, 'Reel 1: seedling heat mats', 'INSTAGRAM', today + 25, 'PLANNED', NULL),
        (gen_random_uuid(), c_confirmed, 'Story set with link', 'INSTAGRAM', today + 45, 'PLANNED', NULL),
        (gen_random_uuid(), c_delivered, 'Long-form video integration', 'YOUTUBE', today - 15, 'PUBLISHED', NULL),
        (gen_random_uuid(), c_delivered, 'TikTok cut-down', 'TIKTOK', today - 10, 'APPROVED', NULL);

    -- ----------------------------------------------------------------- planly
    INSERT INTO task (id, workspace_id, title, description, due_date, due_time, priority, status, recurrence, goal_id,
                      content_draft_id, completed_at)
    VALUES
        (t_reel, ws, 'Film the unboxing Reel', 'Use the north window for soft light.', today, '10:00', 'HIGH', 'IN_PROGRESS', 'NONE', NULL, d_unboxing, NULL),
        (gen_random_uuid(), ws, 'Reply to Greenhouse Co. brief', NULL, today, '14:30', 'URGENT', 'TODO', 'NONE', g_revenue, NULL, NULL),
        (gen_random_uuid(), ws, 'Edit pollinator video (rough cut)', NULL, today + 1, NULL, 'HIGH', 'TODO', 'NONE', g_videos, d_border, NULL),
        (gen_random_uuid(), ws, 'Schedule carousel: five cold-hardy herbs', NULL, today + 2, '09:00', 'MEDIUM', 'TODO', 'NONE', NULL, d_herbs, NULL),
        (gen_random_uuid(), ws, 'Order seed trays for the shoot', NULL, today + 3, NULL, 'LOW', 'TODO', 'NONE', NULL, NULL, NULL),
        (gen_random_uuid(), ws, 'Send second invoice to Greenhouse Co.', NULL, today + 6, NULL, 'HIGH', 'TODO', 'NONE', g_revenue, NULL, NULL),
        (gen_random_uuid(), ws, 'Batch-shoot TikTok tips', NULL, today + 8, '11:00', 'MEDIUM', 'TODO', 'NONE', NULL, NULL, NULL),
        (gen_random_uuid(), ws, 'Publish newsletter issue #1', NULL, today - 3, NULL, 'HIGH', 'TODO', 'NONE', g_newsletter, NULL, NULL),
        (gen_random_uuid(), ws, 'Clean up content calendar', NULL, today - 1, NULL, 'LOW', 'DONE', 'NONE', NULL, NULL, now() - interval '1 day'),
        (gen_random_uuid(), ws, 'Record voiceover for soil test Short', NULL, today - 2, NULL, 'MEDIUM', 'DONE', 'NONE', g_videos, d_soil, now() - interval '2 days'),
        (gen_random_uuid(), ws, 'Water the seedling shelf', NULL, today, '08:00', 'LOW', 'TODO', 'DAILY', NULL, NULL, NULL),
        (gen_random_uuid(), ws, 'Brainstorm autumn series', 'No date yet — pick a slot next week.', NULL, NULL, 'LOW', 'TODO', 'NONE', NULL, NULL, NULL),
        (t_review, ws, 'Weekly analytics review', 'Check growth, top content and sync health; note learnings.',
         today + ((8 - extract(isodow FROM today)::int) % 7), NULL, 'MEDIUM', 'TODO', 'WEEKLY', NULL, NULL, NULL);

    INSERT INTO subtask (id, task_id, title, done, position) VALUES
        (gen_random_uuid(), t_review, 'Review Dashboard trends', false, 0),
        (gen_random_uuid(), t_review, 'Compare top content per platform', false, 1),
        (gen_random_uuid(), t_review, 'Update goal progress', false, 2),
        (gen_random_uuid(), t_reel, 'Set up tripod and reflector', true, 0),
        (gen_random_uuid(), t_reel, 'Shoot three takes', false, 1),
        (gen_random_uuid(), t_reel, 'Pick audio', false, 2);

    INSERT INTO daily_plan (id, workspace_id, plan_date, focus) VALUES
        (gen_random_uuid(), ws, today, 'Finish the unboxing Reel and answer the Greenhouse Co. brief.'),
        (gen_random_uuid(), ws, today - 1, 'Tidy the calendar and prep tomorrow''s shoot.');

    INSERT INTO daily_note (id, workspace_id, note_date, body, version) VALUES
        (gen_random_uuid(), ws, today, E'Shoot notes\n- Soft light from 9:30 to 11:00.\n- Try a top-down angle for the planters.', 0),
        (gen_random_uuid(), ws, today - 1, E'Greenhouse Co. call: they want 2 Reels + 1 Story set in spring. Ask about usage rights.', 0),
        (gen_random_uuid(), ws, today - 3, E'Idea: a "first year allotment" series. Possible collab with a local seed library.', 0);

    RETURN 1;
END;
$$;
