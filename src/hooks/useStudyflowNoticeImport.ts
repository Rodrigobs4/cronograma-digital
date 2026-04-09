import { useCallback, useState } from "react";
import { parseNoticeText } from "../lib/noticeParser";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

interface ImportNoticeInput {
  workspaceId: string | undefined;
  planId: string | undefined;
  title: string;
  organization: string;
  examDate: string;
  fileUrl: string;
  rawText: string;
}

interface ImportNoticeResult {
  subjectsCreated: number;
  topicsCreated: number;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function useStudyflowNoticeImport() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importStructuredNotice = useCallback(async (payload: ImportNoticeInput) => {
    if (!payload.workspaceId || !payload.planId || !isSupabaseConfigured) {
      return null;
    }

    const normalizedTitle = payload.title.trim();
    const normalizedText = payload.rawText.trim();

    if (!normalizedTitle || !normalizedText) {
      return null;
    }

    setSaving(true);
    setError(null);

    try {
      const parsedSubjects = parseNoticeText(normalizedText);

      if (parsedSubjects.length === 0) {
        throw new Error("Não encontrei disciplinas e tópicos válidos no texto informado.");
      }

      const client = getSupabaseClient();

      const [{ data: existingSubjects, error: subjectsError }, { data: catalogRows, error: catalogError }] =
        await Promise.all([
          client
            .from("subjects")
            .select("id, code, name")
            .eq("study_plan_id", payload.planId),
          client.from("subject_catalog").select("id, name"),
        ]);

      if (subjectsError) throw subjectsError;
      if (catalogError) throw catalogError;

      const subjectCatalogMap = new Map(
        (catalogRows ?? []).map((row) => [normalizeName(row.name), row.id as string]),
      );
      const existingByName = new Map(
        (existingSubjects ?? []).map((subject) => [normalizeName(subject.name as string), subject]),
      );
      const existingCodes = new Set(
        (existingSubjects ?? []).map((subject) => String(subject.code)),
      );

      const noticePayload = {
        workspace_id: payload.workspaceId,
        study_plan_id: payload.planId,
        title: normalizedTitle,
        organization: payload.organization.trim() || null,
        exam_date: payload.examDate || null,
        source_type: payload.fileUrl.trim() ? "url" : "manual",
        file_url: payload.fileUrl.trim() || null,
        raw_text: normalizedText,
        parsed_payload: {
          subjects: parsedSubjects.map((subject) => ({
            name: subject.name,
            topics: subject.topics,
          })),
          imported_subjects: parsedSubjects.length,
          imported_topics: parsedSubjects.reduce((total, subject) => total + subject.topics.length, 0),
        },
      };

      const { data: noticeRow, error: noticeError } = await client
        .from("exam_notices")
        .insert(noticePayload)
        .select("id")
        .single();

      if (noticeError) throw noticeError;

      const subjectsCreated: string[] = [];
      let topicsCreated = 0;

      for (const parsedSubject of parsedSubjects) {
        const normalizedSubjectName = normalizeName(parsedSubject.name);
        let subjectId = existingByName.get(normalizedSubjectName)?.id as string | undefined;

        if (!subjectId) {
          const baseCode = slugify(parsedSubject.name) || "disciplina";
          let finalCode = baseCode;
          let counter = 2;

          while (existingCodes.has(finalCode)) {
            finalCode = `${baseCode}-${counter}`;
            counter += 1;
          }

          const { data: createdSubject, error: createSubjectError } = await client
            .from("subjects")
            .insert({
              study_plan_id: payload.planId,
              subject_catalog_id: subjectCatalogMap.get(normalizedSubjectName) ?? null,
              exam_notice_id: noticeRow.id,
              code: finalCode,
              name: parsedSubject.name,
              difficulty_perception: "medium",
              priority_weight: 1,
              target_minutes: Math.max(parsedSubject.topics.length * 45, 120),
              is_active: true,
            })
            .select("id, code, name")
            .single();

          if (createSubjectError) throw createSubjectError;

          subjectId = createdSubject.id as string;
          existingCodes.add(String(createdSubject.code));
          existingByName.set(normalizedSubjectName, createdSubject);
          subjectsCreated.push(subjectId);
        }

        const { data: existingTopics, error: existingTopicsError } = await client
          .from("topics")
          .select("id, title, order_index")
          .eq("subject_id", subjectId);

        if (existingTopicsError) throw existingTopicsError;

        const existingTopicNames = new Set(
          (existingTopics ?? []).map((topic) => normalizeName(String(topic.title))),
        );
        let nextOrder =
          (existingTopics ?? []).reduce(
            (maxOrder, topic) => Math.max(maxOrder, Number(topic.order_index) || 0),
            0,
          ) + 1;

        const newTopics = parsedSubject.topics
          .filter((topic) => !existingTopicNames.has(normalizeName(topic)))
          .map((topic) => ({
            subject_id: subjectId,
            title: topic,
            order_index: nextOrder++,
            status: "not_started" as const,
            source_type: "imported" as const,
          }));

        if (newTopics.length > 0) {
          const { error: createTopicsError } = await client.from("topics").insert(newTopics);

          if (createTopicsError) throw createTopicsError;

          topicsCreated += newTopics.length;
        }
      }

      const { error: importJobError } = await client.from("notice_import_jobs").insert({
        exam_notice_id: noticeRow.id,
        import_status: "processed",
        provider: "local-parser",
        extracted_text: normalizedText,
        processed_at: new Date().toISOString(),
      });

      if (importJobError) throw importJobError;

      return {
        subjectsCreated: subjectsCreated.length,
        topicsCreated,
      } satisfies ImportNoticeResult;
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao importar edital: ${caughtError.message}`
          : "Falha ao importar edital.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    saving,
    error,
    importStructuredNotice,
  };
}
