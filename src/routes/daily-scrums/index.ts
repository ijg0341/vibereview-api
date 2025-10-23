import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  authMiddleware,
  requireTeam,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import { getSupabase } from "../../utils/supabase.js";
import {
  createDailyScrumSchema,
  updateDailyScrumSchema,
  updateParticipantSchema,
  generateSummaryRangeSchema,
  type DailyScrum,
  type DailyScrumParticipant,
  type DailyScrumSummary,
} from "../../types/api.js";

export default async function dailyScrumsRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware
  fastify.addHook("preHandler", authMiddleware);
  fastify.addHook("preHandler", requireTeam());

  // GET /daily-scrums - 데일리 스크럼 목록 조회
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Daily Scrums"],
        summary: "데일리 스크럼 목록 조회",
        description: "팀의 데일리 스크럼 회의 목록을 조회합니다 (최근 30개)",
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  scrums: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        team_id: { type: "string" },
                        created_by: { type: "string" },
                        meeting_date: { type: "string" },
                        status: { type: "string" },
                        started_at: { type: "string" },
                        completed_at: { type: "string" },
                        notes: { type: "string" },
                        team_name: { type: "string" },
                        creator_name: { type: "string" },
                        creator_username: { type: "string" },
                        participant_count: { type: "number" },
                        completed_participants: { type: "number" },
                        created_at: { type: "string" },
                        updated_at: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const supabase = getSupabase();

        // daily_scrum_summary 뷰에서 조회
        const { data: scrums, error } = (await supabase
          .from("daily_scrum_summary")
          .select("*")
          .eq("team_id", user.team_id!)
          .order("meeting_date", { ascending: false })
          .limit(30)) as { data: DailyScrumSummary[]; error: any };

        if (error) {
          request.log.error(error, "Failed to fetch daily scrums");
          return reply.status(500).send({
            success: false,
            error: "Failed to fetch daily scrums",
          });
        }

        return reply.send({
          success: true,
          data: {
            scrums: scrums || [],
          },
        });
      } catch (error) {
        request.log.error(error, "Get daily scrums error");
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // POST /daily-scrums - 데일리 스크럼 생성
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Daily Scrums"],
        summary: "데일리 스크럼 생성",
        description: "새로운 데일리 스크럼 회의를 시작합니다",
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        body: {
          type: "object",
          required: ["team_id", "meeting_date", "participant_ids"],
          properties: {
            team_id: { type: "string" },
            meeting_date: { type: "string", format: "date" },
            participant_ids: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  scrum_id: { type: "string" },
                  meeting_date: { type: "string" },
                  participant_count: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const { team_id, meeting_date, participant_ids } =
          createDailyScrumSchema.parse(request.body);
        const supabase = getSupabase();

        // 팀 검증
        if (team_id !== user.team_id) {
          return reply.status(403).send({
            success: false,
            error: "Access denied. Not in the same team.",
          });
        }

        // 참여자 검증 (모두 같은 팀인지)
        const { data: participants } = (await supabase
          .from("profiles")
          .select("id")
          .eq("team_id", team_id)
          .in("id", participant_ids)) as { data: { id: string }[] };

        if (!participants || participants.length !== participant_ids.length) {
          return reply.status(400).send({
            success: false,
            error: "Some participants are not in the team",
          });
        }

        // 스크럼 생성
        const { data: scrum, error: scrumError } = await supabase
          .from("daily_scrums")
          .insert({
            team_id,
            created_by: user.id,
            meeting_date,
            status: "in_progress",
          } as any)
          .select()
          .single() as { data: DailyScrum; error: any };

        if (scrumError || !scrum) {
          request.log.error(scrumError, "Failed to create scrum");
          return reply.status(500).send({
            success: false,
            error: "Failed to create scrum",
          });
        }

        // 참여자 추가 (어제 AI 요약 가져오기)
        const yesterday = new Date(meeting_date);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        // 각 참여자의 어제 AI 요약 조회 (전체 데이터)
        const { data: summaries } = await supabase
          .from("daily_ai_summaries")
          .select("user_id, summary_text, work_categories, project_todos, quality_score, quality_score_explanation")
          .in("user_id", participant_ids)
          .eq("date", yesterdayStr as any) as {
          data: {
            user_id: string;
            summary_text: string;
            work_categories: any;
            project_todos: any;
            quality_score: number;
            quality_score_explanation: string;
          }[];
        };

        const summaryMap = new Map(
          (summaries || []).map((s) => [s.user_id, JSON.stringify({
            summary_text: s.summary_text,
            work_categories: s.work_categories,
            project_todos: s.project_todos,
            quality_score: s.quality_score,
            quality_score_explanation: s.quality_score_explanation
          })])
        );

        // 참여자 레코드 생성
        const participantRecords = participant_ids.map((userId, index) => ({
          scrum_id: scrum.id,
          user_id: userId,
          order_index: index,
          yesterday_summary: summaryMap.get(userId) || null,
          status: "pending" as const,
        }));

        const { error: participantsError } = await supabase
          .from("daily_scrum_participants")
          .insert(participantRecords as any);

        if (participantsError) {
          request.log.error(participantsError, "Failed to add participants");
          // 롤백: 생성된 스크럼 삭제
          await supabase.from("daily_scrums").delete().eq("id", scrum.id);
          return reply.status(500).send({
            success: false,
            error: "Failed to add participants",
          });
        }

        return reply.status(201).send({
          success: true,
          data: {
            scrum_id: scrum.id,
            meeting_date: scrum.meeting_date,
            participant_count: participant_ids.length,
          },
        });
      } catch (error) {
        request.log.error(error, "Create daily scrum error");
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // GET /daily-scrums/:scrumId - 데일리 스크럼 상세 조회
  fastify.get(
    "/:scrumId",
    {
      schema: {
        tags: ["Daily Scrums"],
        summary: "데일리 스크럼 상세 조회",
        description: "특정 데일리 스크럼 회의의 상세 정보와 참여자 목록을 조회합니다",
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: "object",
          properties: {
            scrumId: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  scrum: {
                    type: "object",
                    additionalProperties: true
                  },
                  participants: { type: "array" },
                },
              },
            },
          },
        },
      },
    },
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const { scrumId } = request.params as { scrumId: string };
        const supabase = getSupabase();

        // 스크럼 조회
        const scrumQuery = await supabase
          .from("daily_scrums")
          .select("*")
          .eq("id", scrumId)
          .eq("team_id", user.team_id!)
          .single() as { data: DailyScrum | null; error: any };

        request.log.info({
          scrumId,
          teamId: user.team_id,
          scrum: scrumQuery.data,
          error: scrumQuery.error,
        }, "Fetching scrum");

        if (scrumQuery.error || !scrumQuery.data) {
          request.log.error({ error: scrumQuery.error, scrumId }, "Scrum not found");
          return reply.status(404).send({
            success: false,
            error: "Scrum not found",
          });
        }

        const scrum = scrumQuery.data;

        // 참여자 조회
        const participantsQuery = await supabase
          .from("daily_scrum_participants")
          .select(
            `
            *,
            user:profiles!user_id (
              id,
              full_name,
              username,
              avatar_url
            )
          `
          )
          .eq("scrum_id", scrumId)
          .order("order_index", { ascending: true });

        if (participantsQuery.error) {
          request.log.error(participantsQuery.error, "Failed to fetch participants");
          return reply.status(500).send({
            success: false,
            error: "Failed to fetch participants",
          });
        }

        // 어제 날짜 계산하여 최신 AI 요약 조회
        const yesterday = new Date(scrum.meeting_date);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const participant_ids = (participantsQuery.data || []).map((p: any) => p.user_id);

        // 최신 AI 요약 조회
        const { data: latestSummaries } = await supabase
          .from("daily_ai_summaries")
          .select("user_id, summary_text, work_categories, project_todos, quality_score, quality_score_explanation")
          .in("user_id", participant_ids)
          .eq("date", yesterdayStr as any) as {
          data: {
            user_id: string;
            summary_text: string;
            work_categories: any;
            project_todos: any;
            quality_score: number;
            quality_score_explanation: string;
          }[];
        };

        const latestSummaryMap = new Map(
          (latestSummaries || []).map((s) => [s.user_id, JSON.stringify({
            summary_text: s.summary_text,
            work_categories: s.work_categories,
            project_todos: s.project_todos,
            quality_score: s.quality_score,
            quality_score_explanation: s.quality_score_explanation
          })])
        );

        // participants에 최신 요약 적용
        const updatedParticipants = (participantsQuery.data || []).map((p: any) => ({
          ...p,
          yesterday_summary: latestSummaryMap.get(p.user_id) || p.yesterday_summary
        }));

        // JSON 직렬화 문제 해결: 새 객체로 복사
        const scrumData = {
          id: scrum.id,
          team_id: scrum.team_id,
          created_by: scrum.created_by,
          meeting_date: scrum.meeting_date,
          status: scrum.status,
          started_at: scrum.started_at,
          completed_at: scrum.completed_at,
          notes: scrum.notes,
          created_at: scrum.created_at,
          updated_at: scrum.updated_at,
        };

        request.log.info({
          scrumKeys: Object.keys(scrumData),
          participantCount: updatedParticipants.length,
          latestSummariesCount: latestSummaries?.length || 0
        }, "Sending response");

        return reply.send({
          success: true,
          data: {
            scrum: scrumData,
            participants: updatedParticipants,
          },
        });
      } catch (error) {
        request.log.error(error, "Get daily scrum error");
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // PUT /daily-scrums/:scrumId - 데일리 스크럼 수정
  fastify.put(
    "/:scrumId",
    {
      schema: {
        tags: ["Daily Scrums"],
        summary: "데일리 스크럼 수정",
        description: "데일리 스크럼 회의 정보를 수정합니다 (상태, 메모 등)",
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: "object",
          properties: {
            scrumId: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["in_progress", "completed", "cancelled"],
            },
            notes: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
            },
          },
        },
      },
    },
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const { scrumId } = request.params as { scrumId: string };
        const updateData = updateDailyScrumSchema.parse(request.body);
        const supabase = getSupabase();

        // 권한 확인
        const { data: scrum } = (await supabase
          .from("daily_scrums")
          .select("created_by, team_id")
          .eq("id", scrumId)
          .single()) as { data: { created_by: string; team_id: string } };

        if (!scrum || scrum.team_id !== user.team_id) {
          return reply.status(404).send({
            success: false,
            error: "Scrum not found",
          });
        }

        if (scrum.created_by !== user.id) {
          return reply.status(403).send({
            success: false,
            error: "Only the creator can update the scrum",
          });
        }

        // 업데이트
        const { data: updated, error } = await (supabase as any)
          .from("daily_scrums")
          .update(updateData)
          .eq("id", scrumId)
          .select()
          .single() as { data: DailyScrum; error: any };

        if (error) {
          request.log.error(error, "Failed to update scrum");
          return reply.status(500).send({
            success: false,
            error: "Failed to update scrum",
          });
        }

        return reply.send({
          success: true,
          data: updated,
        });
      } catch (error) {
        request.log.error(error, "Update daily scrum error");
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // PUT /daily-scrums/:scrumId/participants/:participantId - 참여자 정보 수정
  fastify.put(
    "/:scrumId/participants/:participantId",
    {
      schema: {
        tags: ["Daily Scrums"],
        summary: "참여자 정보 수정",
        description: "참여자의 오늘 계획 메모와 상태를 수정합니다",
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: "object",
          properties: {
            scrumId: { type: "string" },
            participantId: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            today_plan: { type: "string" },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed", "skipped"],
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
            },
          },
        },
      },
    },
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const { scrumId, participantId } = request.params as {
          scrumId: string;
          participantId: string;
        };
        const updateData = updateParticipantSchema.parse(request.body);
        const supabase = getSupabase();

        // 권한 확인
        const { data: participant } = (await supabase
          .from("daily_scrum_participants")
          .select(
            `
            user_id,
            scrum:daily_scrums!scrum_id (
              team_id,
              created_by
            )
          `
          )
          .eq("id", participantId)
          .eq("scrum_id", scrumId)
          .single()) as { data: any };

        if (!participant) {
          return reply.status(404).send({
            success: false,
            error: "Participant not found",
          });
        }

        if (participant.scrum.team_id !== user.team_id) {
          return reply.status(403).send({
            success: false,
            error: "Access denied",
          });
        }

        // 본인 또는 스크럼 생성자만 수정 가능
        if (
          participant.user_id !== user.id &&
          participant.scrum.created_by !== user.id
        ) {
          return reply.status(403).send({
            success: false,
            error: "Only the participant or scrum creator can update",
          });
        }

        // 업데이트
        const { data: updated, error } = await (supabase as any)
          .from("daily_scrum_participants")
          .update(updateData)
          .eq("id", participantId)
          .select()
          .single() as { data: DailyScrumParticipant; error: any };

        if (error) {
          request.log.error(error, "Failed to update participant");
          return reply.status(500).send({
            success: false,
            error: "Failed to update participant",
          });
        }

        return reply.send({
          success: true,
          data: updated,
        });
      } catch (error) {
        request.log.error(error, "Update participant error");
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // DELETE /daily-scrums/:scrumId - 데일리 스크럼 삭제
  fastify.delete(
    "/:scrumId",
    {
      schema: {
        tags: ["Daily Scrums"],
        summary: "데일리 스크럼 삭제",
        description: "데일리 스크럼 회의와 모든 참여자 정보를 삭제합니다",
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: "object",
          properties: {
            scrumId: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const { scrumId } = request.params as { scrumId: string };
        const supabase = getSupabase();

        // 스크럼 조회
        const { data: scrum, error: scrumError } = (await supabase
          .from("daily_scrums")
          .select("*")
          .eq("id", scrumId)
          .eq("team_id", user.team_id!)
          .single()) as { data: DailyScrum; error: any };

        if (scrumError || !scrum) {
          return reply.status(404).send({
            success: false,
            error: "Scrum not found",
          });
        }

        // 생성자만 삭제 가능
        if (scrum.created_by !== user.id) {
          return reply.status(403).send({
            success: false,
            error: "Only the creator can delete this scrum",
          });
        }

        // 참여자 먼저 삭제 (외래 키 제약 조건)
        const { error: participantsError } = await supabase
          .from("daily_scrum_participants")
          .delete()
          .eq("scrum_id", scrumId);

        if (participantsError) {
          request.log.error(participantsError, "Failed to delete participants");
          return reply.status(500).send({
            success: false,
            error: "Failed to delete participants",
          });
        }

        // 스크럼 삭제
        const { error: deleteError } = await supabase
          .from("daily_scrums")
          .delete()
          .eq("id", scrumId);

        if (deleteError) {
          request.log.error(deleteError, "Failed to delete scrum");
          return reply.status(500).send({
            success: false,
            error: "Failed to delete scrum",
          });
        }

        return reply.send({
          success: true,
          message: "Scrum deleted successfully",
        });
      } catch (error) {
        request.log.error(error, "Delete daily scrum error");
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // POST /daily-scrums/generate-summary-range - 기간 내 요약 생성
  fastify.post(
    "/generate-summary-range",
    {
      schema: {
        tags: ["Daily Scrums"],
        summary: "기간 내 AI 요약 생성",
        description:
          "지정된 기간 내의 누락된 날짜에 대해 AI 요약을 생성합니다 (1일, 3일, 7일)",
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        body: {
          type: "object",
          required: ["userId", "startDate", "endDate"],
          properties: {
            userId: { type: "string" },
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
            forceRegenerate: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  generated_dates: {
                    type: "array",
                    items: { type: "string" },
                  },
                  skipped_dates: {
                    type: "array",
                    items: { type: "string" },
                  },
                  total_generated: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const { userId, startDate, endDate, forceRegenerate } =
          generateSummaryRangeSchema.parse(request.body);
        const supabase = getSupabase();

        // 권한 확인 (같은 팀 멤버만)
        if (userId !== user.id) {
          const { data: targetUser } = (await supabase
            .from("profiles")
            .select("team_id")
            .eq("id", userId)
            .single()) as { data: any };

          if (!targetUser || targetUser.team_id !== user.team_id) {
            return reply.status(403).send({
              success: false,
              error: "Access denied. Not in the same team.",
            });
          }
        }

        // 기간 내 날짜 목록 생성
        const dates: string[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split("T")[0] as string);
        }

        // 기존 요약이 있는 날짜 조회
        const { data: existingSummaries } = (await supabase
          .from("daily_ai_summaries")
          .select("date")
          .eq("user_id", userId)
          .in("date", dates)) as { data: { date: string }[] };

        const existingDates = new Set(
          (existingSummaries || []).map((s) => s.date)
        );

        // 생성할 날짜 필터링
        const datesToGenerate = forceRegenerate
          ? dates
          : dates.filter((d) => !existingDates.has(d));

        const generatedDates: string[] = [];
        const skippedDates: string[] = [];

        // 각 날짜에 대해 요약 생성 요청
        for (const date of datesToGenerate) {
          try {
            // teams 라우트의 generate-summary API 호출 (내부)
            const response = await fetch(
              `http://localhost:${process.env.PORT || 3001}/api/teams/generate-summary`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: request.headers.authorization || "",
                },
                body: JSON.stringify({
                  userId,
                  date,
                  forceRegenerate,
                }),
              }
            );

            if (response.ok) {
              generatedDates.push(date);
            } else {
              skippedDates.push(date);
            }
          } catch (err) {
            request.log.error(err, `Failed to generate summary for ${date}`);
            skippedDates.push(date);
          }
        }

        return reply.send({
          success: true,
          data: {
            generated_dates: generatedDates,
            skipped_dates: forceRegenerate
              ? skippedDates
              : skippedDates.concat(Array.from(existingDates)),
            total_generated: generatedDates.length,
          },
        });
      } catch (error) {
        request.log.error(error, "Generate summary range error");
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );
}
