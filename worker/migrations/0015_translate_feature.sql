-- Translate (docs/COMMUNITY.md): a fourth AI feature slot, so a learner can
-- pick the model that translates community notes and replies. SQLite can't
-- change a CHECK, so the table is rebuilt with the same rows.

CREATE TABLE ai_feature_models_v3 (
  user_id       INTEGER NOT NULL,
  feature       TEXT    NOT NULL CHECK (feature IN ('fill', 'propose', 'vision', 'translate')),
  credential_id INTEGER NOT NULL,
  model         TEXT    NOT NULL,
  PRIMARY KEY (user_id, feature)
);
INSERT INTO ai_feature_models_v3 (user_id, feature, credential_id, model)
SELECT user_id, feature, credential_id, model FROM ai_feature_models;
DROP TABLE ai_feature_models;
ALTER TABLE ai_feature_models_v3 RENAME TO ai_feature_models;
