-- ============================================================
-- KIVAW Activity Recommendations Engine - MVP Schema
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ACTIVITIES TABLE (Catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('destructive', 'blank', 'expansive', 'minimize')),
  tags TEXT[] DEFAULT '{}',
  duration_min INTEGER NOT NULL CHECK (duration_min > 0),
  cost_level INTEGER NOT NULL CHECK (cost_level >= 0 AND cost_level <= 3),
  intensity INTEGER NOT NULL CHECK (intensity >= 1 AND intensity <= 5),
  steps TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_mood ON activities(mood);
CREATE INDEX IF NOT EXISTS idx_activities_tags ON activities USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_activities_duration ON activities(duration_min);
CREATE INDEX IF NOT EXISTS idx_activities_cost ON activities(cost_level);
CREATE INDEX IF NOT EXISTS idx_activities_intensity ON activities(intensity);

-- ============================================================
-- 2. SAVED ACTIVITIES TABLE (User Saves)
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT, -- For anonymous users
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_id),
  UNIQUE(session_id, activity_id),
  CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_saved_activities_user ON saved_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_activities_session ON saved_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_saved_activities_activity ON saved_activities(activity_id);

-- ============================================================
-- 3. FEEDBACK EVENTS TABLE (Like/Skip/Complete/Dismiss)
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT, -- For anonymous users
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('like', 'skip', 'complete', 'dismiss')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_events(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON feedback_events(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_activity ON feedback_events(activity_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback_events(event_type);

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_events ENABLE ROW LEVEL SECURITY;

-- Activities: Public read access
DROP POLICY IF EXISTS "Activities are viewable by everyone" ON activities;
CREATE POLICY "Activities are viewable by everyone"
  ON activities FOR SELECT
  USING (true);

-- Saved Activities: Users can only see their own saves
-- Note: For anonymous users, we'll filter by session_id in the application code
-- RLS will handle authenticated users, and we'll allow session_id-based access
DROP POLICY IF EXISTS "Users can view their own saved activities" ON saved_activities;
CREATE POLICY "Users can view their own saved activities"
  ON saved_activities FOR SELECT
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (session_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "Users can insert their own saved activities" ON saved_activities;
CREATE POLICY "Users can insert their own saved activities"
  ON saved_activities FOR INSERT
  WITH CHECK (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (session_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "Users can delete their own saved activities" ON saved_activities;
CREATE POLICY "Users can delete their own saved activities"
  ON saved_activities FOR DELETE
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (session_id IS NOT NULL)
  );

-- Feedback Events: Users can only insert their own feedback
DROP POLICY IF EXISTS "Users can insert their own feedback" ON feedback_events;
CREATE POLICY "Users can insert their own feedback"
  ON feedback_events FOR INSERT
  WITH CHECK (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (session_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback_events;
CREATE POLICY "Users can view their own feedback"
  ON feedback_events FOR SELECT
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (session_id IS NOT NULL)
  );

-- ============================================================
-- 5. HELPER FUNCTION: Get or create session ID
-- ============================================================
CREATE OR REPLACE FUNCTION get_or_create_session_id()
RETURNS TEXT AS $$
DECLARE
  session_id TEXT;
BEGIN
  -- Try to get from app setting (set by client)
  session_id := current_setting('app.session_id', true);
  
  -- If not set, generate a new one (client should store this)
  IF session_id IS NULL OR session_id = '' THEN
    session_id := gen_random_uuid()::TEXT;
  END IF;
  
  RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. SEED DATA: 40 Activities (10 per mood)
-- ============================================================

-- DESTRUCTIVE (10 activities)
INSERT INTO activities (title, description, mood, tags, duration_min, cost_level, intensity, steps) VALUES
('High-Intensity Interval Training', 'Quick bursts of intense exercise followed by short rest periods. Perfect for releasing pent-up energy.', 'destructive', ARRAY['movement', 'high-energy', 'solo'], 30, 0, 5, ARRAY['Warm up for 5 minutes', 'Do 20 seconds of burpees', 'Rest 10 seconds', 'Repeat 8 rounds', 'Cool down for 5 minutes']),
('Punching Bag Workout', 'Release stress and build strength with a punching bag session.', 'destructive', ARRAY['movement', 'high-energy', 'solo'], 20, 1, 5, ARRAY['Put on gloves', 'Warm up with light jabs', 'Do 3-minute rounds with 1-minute rest', 'Cool down']),
('Aggressive Dancing', 'Put on high-energy music and dance like nobody is watching. Let it all out.', 'destructive', ARRAY['movement', 'high-energy', 'solo'], 15, 0, 4, ARRAY['Choose high-energy playlist', 'Clear space', 'Dance freely for 15 minutes', 'Stretch afterwards']),
('Scream into a Pillow', 'Sometimes you just need to let it out. Find a private space and scream.', 'destructive', ARRAY['emotional-release', 'low-energy', 'solo'], 5, 0, 2, ARRAY['Find a private space', 'Grab a pillow', 'Scream into it', 'Take deep breaths']),
('Rage Room Session', 'Break things safely in a controlled environment. Check for local rage rooms.', 'destructive', ARRAY['emotional-release', 'high-energy', 'social'], 60, 3, 5, ARRAY['Book a rage room session', 'Bring protective gear', 'Follow safety instructions', 'Break things safely']),
('Intense Cardio Run', 'Go for a fast-paced run to burn off excess energy and clear your mind.', 'destructive', ARRAY['movement', 'high-energy', 'solo'], 30, 0, 5, ARRAY['Warm up with light jog', 'Run at high intensity', 'Maintain pace for 20 minutes', 'Cool down walk']),
('Boxing Class', 'Join a boxing class to channel destructive energy into skill-building.', 'destructive', ARRAY['movement', 'high-energy', 'social'], 60, 2, 5, ARRAY['Find local boxing gym', 'Book a class', 'Bring water and towel', 'Follow instructor']),
('Heavy Metal Workout', 'Lift weights while listening to heavy metal. Channel the aggression.', 'destructive', ARRAY['movement', 'high-energy', 'solo'], 45, 1, 4, ARRAY['Choose heavy metal playlist', 'Warm up', 'Do compound lifts', 'Cool down']),
('Destructive Art Session', 'Create art by destroying and rebuilding. Tear paper, paint aggressively.', 'destructive', ARRAY['creative', 'med-energy', 'solo'], 30, 1, 3, ARRAY['Gather materials', 'Tear or cut paper', 'Paint or collage aggressively', 'Let it dry']),
('Competitive Sports', 'Join a pickup game of basketball, soccer, or any competitive sport.', 'destructive', ARRAY['movement', 'high-energy', 'social'], 60, 0, 5, ARRAY['Find local court or field', 'Join or organize game', 'Play competitively', 'Cool down']),

-- BLANK (10 activities)
('Meditation', 'Sit in silence and observe your thoughts without judgment. Let your mind be blank.', 'blank', ARRAY['mindfulness', 'low-energy', 'solo'], 15, 0, 1, ARRAY['Find quiet space', 'Sit comfortably', 'Close eyes', 'Focus on breath', 'Observe thoughts']),
('Cloud Watching', 'Lie down and watch clouds drift by. Let your mind wander.', 'blank', ARRAY['mindfulness', 'low-energy', 'solo'], 20, 0, 1, ARRAY['Find outdoor spot', 'Lie down comfortably', 'Watch clouds', 'Let mind wander']),
('Minimalist Drawing', 'Draw simple shapes and lines. No pressure, just basic marks on paper.', 'blank', ARRAY['creative', 'low-energy', 'solo'], 20, 0, 1, ARRAY['Get paper and pen', 'Draw simple shapes', 'No expectations', 'Let it be minimal']),
('Silent Walk', 'Take a walk without music or podcasts. Just walk and observe.', 'blank', ARRAY['movement', 'low-energy', 'solo'], 30, 0, 1, ARRAY['Leave devices behind', 'Walk slowly', 'Observe surroundings', 'Stay present']),
('Stare at a Candle', 'Light a candle and stare at the flame. Let your mind empty.', 'blank', ARRAY['mindfulness', 'low-energy', 'solo'], 10, 0, 1, ARRAY['Light candle', 'Sit comfortably', 'Stare at flame', 'Clear your mind']),
('Blank Journaling', 'Write without purpose. Just let words flow onto the page.', 'blank', ARRAY['creative', 'low-energy', 'solo'], 15, 0, 1, ARRAY['Get journal', 'Start writing', 'No structure needed', 'Let thoughts flow']),
('Gentle Stretching', 'Do very gentle stretches. No intensity, just slow movement.', 'blank', ARRAY['movement', 'low-energy', 'solo'], 15, 0, 1, ARRAY['Find quiet space', 'Do gentle stretches', 'Hold each 30 seconds', 'Breathe deeply']),
('Listen to White Noise', 'Put on white noise or nature sounds. Just listen.', 'blank', ARRAY['mindfulness', 'low-energy', 'solo'], 20, 0, 1, ARRAY['Find white noise app', 'Put on headphones', 'Lie down', 'Just listen']),
('Empty Room Sitting', 'Sit in an empty room with nothing to do. Just be.', 'blank', ARRAY['mindfulness', 'low-energy', 'solo'], 15, 0, 1, ARRAY['Find empty room', 'Sit comfortably', 'Do nothing', 'Just exist']),
('Minimalist Cleaning', 'Clean one small area mindfully. No rush, just the action.', 'blank', ARRAY['movement', 'low-energy', 'solo'], 20, 0, 1, ARRAY['Choose small area', 'Clean slowly', 'Focus on action', 'No multitasking']),

-- EXPANSIVE (10 activities)
('Learn a New Skill', 'Pick something you''ve always wanted to learn and start today.', 'expansive', ARRAY['learning', 'med-energy', 'solo'], 60, 1, 3, ARRAY['Choose skill', 'Find tutorial or course', 'Set up workspace', 'Start learning', 'Practice for 30+ minutes']),
('Explore a New Neighborhood', 'Walk through a part of your city you''ve never visited.', 'expansive', ARRAY['exploration', 'med-energy', 'solo'], 90, 0, 2, ARRAY['Choose new area', 'Walk around', 'Notice new things', 'Take photos if desired']),
('Read an Inspiring Book', 'Pick up a book that expands your perspective or teaches something new.', 'expansive', ARRAY['learning', 'low-energy', 'solo'], 60, 1, 1, ARRAY['Choose inspiring book', 'Find comfortable spot', 'Read for 30+ minutes', 'Take notes if desired']),
('Start a Creative Project', 'Begin a new creative endeavor - writing, painting, music, coding.', 'expansive', ARRAY['creative', 'med-energy', 'solo'], 120, 1, 3, ARRAY['Choose project', 'Gather materials', 'Set up workspace', 'Start creating', 'Work for 1+ hours']),
('Attend a Workshop or Class', 'Sign up for a class that interests you - cooking, art, language, etc.', 'expansive', ARRAY['learning', 'med-energy', 'social'], 120, 2, 3, ARRAY['Find interesting class', 'Sign up', 'Attend session', 'Engage with others']),
('Plan a Future Adventure', 'Research and plan a trip or adventure you want to take.', 'expansive', ARRAY['planning', 'low-energy', 'solo'], 60, 0, 1, ARRAY['Choose destination', 'Research online', 'Create itinerary', 'Set budget', 'Book if ready']),
('Try a New Recipe', 'Cook something you''ve never made before. Experiment with flavors.', 'expansive', ARRAY['creative', 'med-energy', 'solo'], 60, 1, 2, ARRAY['Find new recipe', 'Get ingredients', 'Follow steps', 'Taste and adjust', 'Enjoy meal']),
('Join a Community Group', 'Find a local group related to your interests and attend a meeting.', 'expansive', ARRAY['social', 'med-energy', 'social'], 90, 0, 3, ARRAY['Search for groups', 'Choose one', 'Attend meeting', 'Meet new people', 'Engage in activities']),
('Write Future Goals', 'Sit down and write out your goals and dreams. Be expansive.', 'expansive', ARRAY['planning', 'low-energy', 'solo'], 30, 0, 1, ARRAY['Get journal', 'Write freely', 'Think big', 'No limits', 'Review and refine']),
('Explore New Music', 'Discover new artists and genres you''ve never listened to before.', 'expansive', ARRAY['exploration', 'low-energy', 'solo'], 45, 0, 1, ARRAY['Open music app', 'Search new genres', 'Listen to recommendations', 'Save favorites', 'Create playlist']),

-- MINIMIZE (10 activities)
('Cozy Blanket Fort', 'Build a fort with blankets and pillows. Make it your safe space.', 'minimize', ARRAY['comfort', 'low-energy', 'solo'], 30, 0, 1, ARRAY['Gather blankets', 'Build fort structure', 'Add pillows', 'Get inside', 'Relax']),
('Warm Bath with Epsom Salts', 'Take a long, warm bath to soothe your body and mind.', 'minimize', ARRAY['self-care', 'low-energy', 'solo'], 30, 1, 1, ARRAY['Fill tub with warm water', 'Add Epsom salts', 'Get in', 'Relax for 20+ minutes', 'Dry off gently']),
('Comfort Food Cooking', 'Make your favorite comfort food. Something simple and familiar.', 'minimize', ARRAY['self-care', 'med-energy', 'solo'], 45, 1, 2, ARRAY['Choose comfort recipe', 'Gather ingredients', 'Cook slowly', 'Enjoy meal', 'Clean up later']),
('Gentle Yoga Flow', 'Do a very gentle yoga sequence. Focus on comfort, not intensity.', 'minimize', ARRAY['movement', 'low-energy', 'solo'], 30, 0, 1, ARRAY['Find quiet space', 'Put on gentle music', 'Do gentle poses', 'Hold each pose', 'End in savasana']),
('Read Familiar Book', 'Re-read a book you love. Something comforting and known.', 'minimize', ARRAY['comfort', 'low-energy', 'solo'], 60, 0, 1, ARRAY['Choose favorite book', 'Find cozy spot', 'Read familiar pages', 'Let it comfort you']),
('Soft Music Listening', 'Put on soft, calming music. Classical, ambient, or lo-fi.', 'minimize', ARRAY['comfort', 'low-energy', 'solo'], 30, 0, 1, ARRAY['Choose soft playlist', 'Put on headphones', 'Lie down', 'Just listen', 'Let it soothe']),
('Weighted Blanket Time', 'Wrap yourself in a weighted blanket and just rest.', 'minimize', ARRAY['comfort', 'low-energy', 'solo'], 30, 1, 1, ARRAY['Get weighted blanket', 'Wrap yourself', 'Lie down', 'Feel the pressure', 'Rest']),
('Herbal Tea Ritual', 'Make a cup of herbal tea and drink it slowly, mindfully.', 'minimize', ARRAY['self-care', 'low-energy', 'solo'], 15, 0, 1, ARRAY['Choose herbal tea', 'Boil water', 'Steep tea', 'Sit comfortably', 'Sip slowly']),
('Soft Lighting Setup', 'Turn off bright lights, use candles or soft lamps. Create a gentle atmosphere.', 'minimize', ARRAY['comfort', 'low-energy', 'solo'], 10, 0, 1, ARRAY['Turn off bright lights', 'Light candles or soft lamps', 'Adjust room', 'Enjoy gentle light']),
('Cuddle with Pet or Stuffed Animal', 'Physical comfort from a pet or soft object. Just hold and be held.', 'minimize', ARRAY['comfort', 'low-energy', 'solo'], 20, 0, 1, ARRAY['Find pet or stuffed animal', 'Get comfortable', 'Hold gently', 'Feel the comfort', 'Stay present']);

-- ============================================================
-- 7. COMMENTS
-- ============================================================
COMMENT ON TABLE activities IS 'Catalog of all available activities for recommendations';
COMMENT ON TABLE saved_activities IS 'User-saved activities (supports both authenticated and anonymous users)';
COMMENT ON TABLE feedback_events IS 'User feedback on activities (like, skip, complete, dismiss)';

