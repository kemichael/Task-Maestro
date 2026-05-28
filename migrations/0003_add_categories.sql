-- BD-103: カテゴリ情報を JSON で保持 (Backlog の category[] を {id, name}[] のまま保存)

ALTER TABLE backlog_issue ADD COLUMN categories_json TEXT;
