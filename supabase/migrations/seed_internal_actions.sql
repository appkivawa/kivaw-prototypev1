-- ============================================================
-- SEED INTERNAL ACTIONS
-- ============================================================
-- 20 Reset actions, 20 Move actions, 20 Create prompts
-- ============================================================

-- Reset Actions (20)
INSERT INTO public.internal_actions (type, title, description, duration_min, energy_min, state_fit, tags, intensity, cognitive_load, novelty, link, why) VALUES
('reset', '5-Minute Breathing Reset', 'Simple box breathing: 4 counts in, 4 hold, 4 out, 4 hold. Repeat 5 times.', 5, 1, ARRAY['blank', 'minimize'], ARRAY['calm', 'minimal', 'reset'], 0.1, 0.1, 0.2, NULL, 'Quick reset: minimal effort, immediate calm.'),
('reset', 'Cold Water Splash', 'Splash cold water on your face and wrists. Takes 30 seconds.', 1, 1, ARRAY['blank', 'destructive', 'minimize'], ARRAY['reset', 'energizing'], 0.2, 0.1, 0.3, NULL, 'Instant reset: physical cue to shift state.'),
('reset', 'Stand and Stretch', 'Stand up, reach arms overhead, hold 10 seconds. Repeat 3 times.', 2, 1, ARRAY['blank', 'minimize'], ARRAY['gentle', 'movement', 'reset'], 0.15, 0.1, 0.2, NULL, 'Gentle movement: breaks mental loops.'),
('reset', 'Step Outside', 'Walk outside (or to a window) and take 5 deep breaths of fresh air.', 3, 1, ARRAY['blank', 'expansive', 'minimize'], ARRAY['calm', 'nature', 'reset'], 0.1, 0.1, 0.4, NULL, 'Environmental reset: fresh perspective.'),
('reset', 'Gratitude List', 'Write down 3 things you''re grateful for right now. One sentence each.', 3, 1, ARRAY['blank', 'expansive', 'minimize'], ARRAY['reflection', 'positive', 'reset'], 0.1, 0.2, 0.3, NULL, 'Cognitive reset: shifts focus to positive.'),
('reset', 'Phone Away', 'Put your phone in another room for 10 minutes. Just be.', 10, 1, ARRAY['blank', 'minimize'], ARRAY['minimal', 'reset', 'calm'], 0.05, 0.1, 0.5, NULL, 'Digital reset: removes stimulation.'),
('reset', 'Count to 10 Slowly', 'Count from 1 to 10, one number per breath. If you lose focus, start over.', 2, 1, ARRAY['blank', 'minimize'], ARRAY['calm', 'mindful', 'reset'], 0.1, 0.15, 0.2, NULL, 'Mindful reset: anchors attention.'),
('reset', 'Change Your Scenery', 'Move to a different room or spot. New physical space = new mental space.', 1, 1, ARRAY['blank', 'expansive'], ARRAY['reset', 'change'], 0.1, 0.1, 0.4, NULL, 'Spatial reset: breaks routine patterns.'),
('reset', 'Drink a Glass of Water', 'Slowly drink a full glass of water. Focus on the sensation.', 2, 1, ARRAY['blank', 'minimize'], ARRAY['gentle', 'reset'], 0.05, 0.1, 0.2, NULL, 'Simple reset: basic self-care cue.'),
('reset', 'Name 5 Things You See', 'Look around and name 5 things you can see. Grounding exercise.', 1, 1, ARRAY['blank', 'minimize'], ARRAY['grounding', 'reset'], 0.1, 0.1, 0.3, NULL, 'Grounding reset: brings you to present.'),
('reset', 'Hum a Tune', 'Hum a simple melody for 30 seconds. Vibration is calming.', 1, 1, ARRAY['blank', 'minimize'], ARRAY['calm', 'reset'], 0.1, 0.1, 0.3, NULL, 'Vocal reset: physical vibration calms.'),
('reset', 'Tidy One Surface', 'Pick one surface (desk, table) and put 3 things away. Minimal effort, visible change.', 2, 1, ARRAY['blank', 'minimize'], ARRAY['action', 'reset'], 0.15, 0.1, 0.3, NULL, 'Action reset: small win, clear result.'),
('reset', 'Look at the Sky', 'Go outside or to a window and look at the sky for 1 minute. Just observe.', 1, 1, ARRAY['blank', 'expansive', 'minimize'], ARRAY['calm', 'nature', 'reset'], 0.1, 0.1, 0.4, NULL, 'Perspective reset: vastness calms.'),
('reset', 'Shake It Out', 'Stand and shake your hands, arms, legs for 30 seconds. Release tension.', 1, 1, ARRAY['blank', 'destructive'], ARRAY['release', 'reset'], 0.2, 0.1, 0.3, NULL, 'Physical reset: releases stored energy.'),
('reset', 'Write One Sentence', 'Write one sentence about how you feel right now. No editing.', 2, 1, ARRAY['blank', 'expansive'], ARRAY['reflection', 'reset'], 0.1, 0.2, 0.3, NULL, 'Expression reset: externalizes feeling.'),
('reset', 'Close Your Eyes', 'Close your eyes and count 10 breaths. Nothing else.', 2, 1, ARRAY['blank', 'minimize'], ARRAY['calm', 'reset'], 0.05, 0.1, 0.2, NULL, 'Sensory reset: removes visual input.'),
('reset', 'Touch Something Textured', 'Find something with an interesting texture. Touch it for 10 seconds. Focus on sensation.', 1, 1, ARRAY['blank', 'minimize'], ARRAY['grounding', 'reset'], 0.1, 0.1, 0.3, NULL, 'Tactile reset: anchors in present.'),
('reset', 'Say Your Name Out Loud', 'Say your own name out loud, slowly. Identity anchor.', 1, 1, ARRAY['blank'], ARRAY['identity', 'reset'], 0.1, 0.1, 0.4, NULL, 'Identity reset: reminds you who you are.'),
('reset', 'One Deep Sigh', 'Take one very deep breath in, hold 3 seconds, release with a sigh. Repeat once.', 1, 1, ARRAY['blank', 'minimize'], ARRAY['calm', 'reset'], 0.1, 0.1, 0.2, NULL, 'Breath reset: physiological calm.'),
('reset', 'Check the Time', 'Check what time it is. Acknowledge where you are in the day. That''s it.', 1, 1, ARRAY['blank', 'minimize'], ARRAY['awareness', 'reset'], 0.05, 0.1, 0.2, NULL, 'Temporal reset: anchors in time.'),

-- Move Actions (20)
('move', '10-Minute Walk', 'Walk around your block or neighborhood. No destination needed.', 10, 1, ARRAY['blank', 'expansive', 'minimize'], ARRAY['gentle', 'movement', 'outdoor'], 0.2, 0.1, 0.4, NULL, 'Gentle movement: clears head, low effort.'),
('move', 'Dance to One Song', 'Put on one song you love and move your body however feels right.', 4, 2, ARRAY['blank', 'destructive', 'expansive'], ARRAY['energetic', 'fun', 'movement'], 0.4, 0.1, 0.5, NULL, 'Energetic release: music + movement.'),
('move', '5-Minute Stretch Routine', 'Standing stretches: reach up, side bends, forward fold, gentle twists.', 5, 1, ARRAY['blank', 'minimize'], ARRAY['gentle', 'movement', 'stretch'], 0.15, 0.1, 0.3, NULL, 'Gentle movement: releases tension.'),
('move', 'Jumping Jacks', 'Do 20 jumping jacks (or as many as you can). Quick energy boost.', 2, 2, ARRAY['blank', 'destructive'], ARRAY['energetic', 'movement'], 0.5, 0.1, 0.3, NULL, 'Quick energy: raises heart rate fast.'),
('move', 'Yoga Flow', 'Simple sun salutation: 3 rounds. 5 minutes.', 5, 1, ARRAY['blank', 'minimize'], ARRAY['calm', 'movement', 'mindful'], 0.2, 0.15, 0.4, NULL, 'Mindful movement: breath + motion.'),
('move', 'Stairs', 'Walk up and down stairs 3 times (or find a hill).', 3, 2, ARRAY['blank', 'destructive'], ARRAY['energetic', 'movement'], 0.4, 0.1, 0.3, NULL, 'Cardio boost: quick intensity.'),
('move', 'Wall Push-ups', 'Do 10-15 wall push-ups. Upper body activation.', 2, 2, ARRAY['blank', 'destructive'], ARRAY['strength', 'movement'], 0.35, 0.1, 0.3, NULL, 'Strength movement: builds energy.'),
('move', 'Tai Chi Flow', 'Slow, flowing movements: 5 minutes. YouTube a simple routine if needed.', 5, 1, ARRAY['blank', 'minimize'], ARRAY['calm', 'movement', 'mindful'], 0.15, 0.2, 0.5, NULL, 'Calm movement: meditative motion.'),
('move', 'Run in Place', 'Run in place for 1 minute. High knees if you can.', 1, 3, ARRAY['destructive'], ARRAY['energetic', 'movement'], 0.6, 0.1, 0.3, NULL, 'High energy: quick release.'),
('move', 'Balance on One Foot', 'Stand on one foot for 30 seconds, switch. Repeat 3 times each.', 3, 1, ARRAY['blank', 'minimize'], ARRAY['gentle', 'movement', 'focus'], 0.1, 0.15, 0.4, NULL, 'Focused movement: requires attention.'),
('move', 'Hip Circles', 'Stand and make big circles with your hips: 10 each direction.', 2, 1, ARRAY['blank', 'minimize'], ARRAY['gentle', 'movement'], 0.15, 0.1, 0.3, NULL, 'Gentle movement: releases hips.'),
('move', 'Shadow Boxing', 'Punch the air for 1 minute. Fast, controlled movements.', 1, 3, ARRAY['destructive'], ARRAY['energetic', 'release', 'movement'], 0.7, 0.1, 0.4, NULL, 'Cathartic movement: releases aggression.'),
('move', 'March in Place', 'March in place for 2 minutes. Lift knees high.', 2, 2, ARRAY['blank', 'destructive'], ARRAY['energetic', 'movement'], 0.3, 0.1, 0.2, NULL, 'Moderate movement: raises energy.'),
('move', 'Cat-Cow Stretch', 'On hands and knees: arch back (cow), round back (cat). 10 rounds.', 2, 1, ARRAY['blank', 'minimize'], ARRAY['gentle', 'stretch', 'movement'], 0.1, 0.1, 0.3, NULL, 'Gentle stretch: spinal mobility.'),
('move', 'Squats', 'Do 10-15 bodyweight squats. Take your time.', 2, 2, ARRAY['blank', 'destructive'], ARRAY['strength', 'movement'], 0.4, 0.1, 0.3, NULL, 'Strength movement: builds power.'),
('move', 'Arm Circles', 'Stand and make big circles with your arms: 10 forward, 10 back.', 1, 1, ARRAY['blank', 'minimize'], ARRAY['gentle', 'movement'], 0.1, 0.1, 0.2, NULL, 'Gentle movement: shoulder mobility.'),
('move', 'Walk and Breathe', 'Walk slowly while matching steps to breath: 4 steps in, 4 steps out.', 5, 1, ARRAY['blank', 'minimize'], ARRAY['calm', 'movement', 'mindful'], 0.15, 0.15, 0.4, NULL, 'Mindful movement: breath + steps.'),
('move', 'Leg Swings', 'Hold a wall, swing one leg forward and back: 10 each leg.', 2, 1, ARRAY['blank', 'minimize'], ARRAY['gentle', 'movement'], 0.1, 0.1, 0.3, NULL, 'Gentle movement: hip mobility.'),
('move', 'Burpees', 'Do 5 burpees (or modified: step back instead of jump).', 2, 4, ARRAY['destructive'], ARRAY['energetic', 'movement'], 0.8, 0.1, 0.3, NULL, 'High intensity: full body release.'),
('move', 'Shake Your Whole Body', 'Stand and shake every part of your body for 1 minute. Let it be loose.', 1, 2, ARRAY['blank', 'destructive'], ARRAY['release', 'movement'], 0.3, 0.1, 0.4, NULL, 'Release movement: shakes out tension.'),

-- Create Actions (20)
('create', 'Write a Haiku', 'Write a 3-line poem (5-7-5 syllables). About anything.', 5, 1, ARRAY['blank', 'expansive', 'minimize'], ARRAY['writing', 'creative', 'minimal'], 0.2, 0.3, 0.5, NULL, 'Creative expression: structured, minimal.'),
('create', 'Draw a Doodle', 'Draw whatever comes to mind for 3 minutes. No judgment.', 3, 1, ARRAY['blank', 'expansive', 'minimize'], ARRAY['art', 'creative'], 0.15, 0.2, 0.5, NULL, 'Visual creation: no rules needed.'),
('create', 'Write One Gratitude', 'Write one paragraph about something you''re grateful for today.', 3, 1, ARRAY['blank', 'expansive', 'minimize'], ARRAY['writing', 'reflection', 'creative'], 0.1, 0.2, 0.3, NULL, 'Reflective creation: positive focus.'),
('create', 'Make a Playlist', 'Create a 5-song playlist for your current mood. Title it.', 10, 1, ARRAY['blank', 'expansive'], ARRAY['music', 'creative'], 0.2, 0.25, 0.6, NULL, 'Curatorial creation: music selection.'),
('create', 'Cook Something Simple', 'Make one simple dish: scrambled eggs, toast, or a smoothie.', 10, 2, ARRAY['blank', 'expansive'], ARRAY['cooking', 'creative'], 0.25, 0.3, 0.4, NULL, 'Practical creation: tangible result.'),
('create', 'Write a Letter (Don''t Send)', 'Write a letter to someone. You don''t have to send it.', 10, 1, ARRAY['blank', 'expansive'], ARRAY['writing', 'creative', 'reflection'], 0.2, 0.3, 0.4, NULL, 'Expressive creation: externalizes thoughts.'),
('create', 'Rearrange One Shelf', 'Pick one shelf or surface and rearrange it. New arrangement.', 5, 1, ARRAY['blank', 'expansive', 'minimize'], ARRAY['space', 'creative'], 0.15, 0.2, 0.4, NULL, 'Spatial creation: visible change.'),
('create', 'Sing a Song', 'Sing a song you know by heart. Out loud or quietly.', 3, 1, ARRAY['blank', 'expansive'], ARRAY['music', 'creative'], 0.2, 0.15, 0.4, NULL, 'Vocal creation: music expression.'),
('create', 'Write a List', 'Make a list: 10 things you want to do this week, or 5 favorite memories.', 5, 1, ARRAY['blank', 'expansive'], ARRAY['writing', 'creative'], 0.15, 0.2, 0.3, NULL, 'List creation: organizes thoughts.'),
('create', 'Take a Photo', 'Take one photo of something that catches your eye. No editing needed.', 2, 1, ARRAY['blank', 'expansive'], ARRAY['photography', 'creative'], 0.2, 0.2, 0.5, NULL, 'Visual creation: captures moment.'),
('create', 'Make a Collage', 'Cut or tear images from a magazine (or print) and arrange them on paper.', 10, 1, ARRAY['blank', 'expansive'], ARRAY['art', 'creative'], 0.2, 0.25, 0.6, NULL, 'Visual creation: hands-on making.'),
('create', 'Write a Story Start', 'Write the first paragraph of a story. It doesn''t need to go anywhere.', 5, 1, ARRAY['blank', 'expansive'], ARRAY['writing', 'creative'], 0.25, 0.3, 0.5, NULL, 'Narrative creation: opens possibilities.'),
('create', 'Build with What You Have', 'Use objects around you to build a small structure or arrangement.', 5, 1, ARRAY['blank', 'expansive'], ARRAY['making', 'creative'], 0.2, 0.25, 0.6, NULL, 'Physical creation: hands-on building.'),
('create', 'Write Morning Pages', 'Write 3 pages of stream-of-consciousness. No editing, just write.', 15, 1, ARRAY['blank', 'expansive'], ARRAY['writing', 'creative', 'reflection'], 0.2, 0.3, 0.4, NULL, 'Free-form creation: clears mind.'),
('create', 'Make a Vision Board', 'Cut out images/words that resonate and arrange on paper. 10 minutes.', 10, 1, ARRAY['blank', 'expansive'], ARRAY['art', 'creative', 'future'], 0.2, 0.25, 0.5, NULL, 'Visual creation: future-oriented.'),
('create', 'Write a Recipe', 'Write down a recipe you know by heart (or invent one).', 5, 1, ARRAY['blank', 'expansive'], ARRAY['writing', 'creative'], 0.15, 0.2, 0.3, NULL, 'Practical creation: knowledge sharing.'),
('create', 'Sketch Your Hand', 'Draw your non-dominant hand. 5 minutes, no erasing.', 5, 1, ARRAY['blank', 'expansive', 'minimize'], ARRAY['art', 'creative'], 0.2, 0.25, 0.5, NULL, 'Observational creation: focuses attention.'),
('create', 'Write a Mantra', 'Write one sentence you want to remember today. Make it yours.', 2, 1, ARRAY['blank', 'expansive', 'minimize'], ARRAY['writing', 'creative'], 0.1, 0.15, 0.4, NULL, 'Affirmative creation: personal statement.'),
('create', 'Make a Sound', 'Create a rhythm or melody by tapping, humming, or using objects.', 3, 1, ARRAY['blank', 'expansive'], ARRAY['music', 'creative'], 0.2, 0.2, 0.5, NULL, 'Sonic creation: music making.'),
('create', 'Write a Question', 'Write one question you want to explore. No answer needed.', 2, 1, ARRAY['blank', 'expansive'], ARRAY['writing', 'creative', 'curiosity'], 0.15, 0.2, 0.5, NULL, 'Inquiry creation: opens exploration.')
ON CONFLICT DO NOTHING;






