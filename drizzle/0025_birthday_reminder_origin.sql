-- Custom SQL migration file, put your code below! --

-- Origem do lembrete (issue #44). `reminder_sends` passou a servir a duas origens: o
-- compromisso da Agenda (`event_id`) e o aniversário de uma pessoa (`person_id`). São
-- coisas diferentes, mas o problema é o mesmo — não mandar a notificação duas vezes —, e
-- duas tabelas para isso se desencontrariam.
--
-- Exatamente **uma** das duas é preenchida. Sem esta checagem, uma linha com as duas nulas
-- não marcaria nada e uma com as duas preenchidas marcaria a coisa errada; nos dois casos
-- o defeito só apareceria como notificação repetida na mão do dono.
ALTER TABLE "reminder_sends"
  ADD CONSTRAINT "reminder_sends_one_origin"
  CHECK (("event_id" IS NOT NULL) <> ("person_id" IS NOT NULL));
