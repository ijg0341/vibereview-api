import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  authMiddleware,
  requireTeam,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import { getSupabase } from "../../utils/supabase.js";
import { generateWithClaude } from "../../utils/claude-api.js";
import {
  parseSummaryMarkdown,
  serializeParsedData,
} from "../../utils/summary-parser.js";
import { z } from "zod";

export default async function teamsRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware
  fastify.addHook("preHandler", authMiddleware);
  fastify.addHook("preHandler", requireTeam());

  // GET /teams/current/members - 현재 팀의 모든 멤버 목록
  fastify.get(
    "/current/members",
    {
      schema: {
        tags: ["Teams"],
        summary: "팀 멤버 목록 조회",
        description: "현재 팀에 속한 모든 멤버들과 활동 요약을 조회합니다",
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  team: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      member_count: { type: "number" },
                    },
                  },
                  members: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        email: { type: "string" },
                        full_name: { type: "string" },
                        username: { type: "string" },
                        avatar_url: { type: "string" },
                        role: { type: "string" },
                        activity_summary: {
                          type: "object",
                          properties: {
                            total_files: { type: "number" },
                            total_size: { type: "number" },
                            last_upload: { type: "string" },
                            favorite_tool: { type: "string" },
                            projects_count: { type: "number" },
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
      },
    },
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const supabase = getSupabase();

        // 팀 정보 조회
        const { data: team, error: teamError } = (await supabase
          .from("teams")
          .select("id, name, description")
          .eq("id", user.team_id!)
          .single()) as { data: any; error: any };

        if (teamError) {
          request.log.error(teamError, "Failed to fetch team info");
          return reply.status(500).send({
            success: false,
            error: "Failed to fetch team information",
          });
        }

        // 팀 멤버들 조회
        const { data: profiles, error: profilesError } = (await supabase
          .from("profiles")
          .select(
            "id, full_name, username, avatar_url, role, is_active, created_at"
          )
          .eq("team_id", user.team_id!)
          .eq("is_active", true)) as { data: any; error: any };

        if (profilesError) {
          request.log.error(profilesError, "Failed to fetch team members");
          return reply.status(500).send({
            success: false,
            error: "Failed to fetch team members",
          });
        }

        // 각 멤버의 활동 요약 계산
        const membersWithActivity = await Promise.all(
          (profiles || []).map(async (profile: any) => {
            // 멤버의 파일 업로드 통계
            const { data: files } = (await supabase
              .from("uploaded_files")
              .select("file_size, tool_name, metadata, created_at")
              .eq("user_id", profile.id)) as { data: any };

            const totalFiles = files?.length || 0;
            const totalSize =
              files?.reduce(
                (sum: number, file: any) => sum + (file.file_size || 0),
                0
              ) || 0;

            // 가장 많이 사용한 도구
            const toolCounts =
              files?.reduce((acc: Record<string, number>, file: any) => {
                const tool = file.tool_name || "Unknown";
                acc[tool] = (acc[tool] || 0) + 1;
                return acc;
              }, {}) || {};

            const favoriteTools = Object.entries(toolCounts).sort(
              ([, a], [, b]) => (b as number) - (a as number)
            );
            const favoriteTool = favoriteTools[0]?.[0] || "None";

            // 프로젝트 수
            const projectsSet = new Set();
            files?.forEach((file: any) => {
              const projectName =
                file.metadata?.project || file.tool_name || "Default";
              projectsSet.add(projectName);
            });

            // 마지막 업로드
            const lastUpload =
              files?.length > 0 ? files[files.length - 1]?.created_at : null;

            return {
              id: profile.id,
              full_name: profile.full_name,
              username: profile.username,
              avatar_url: profile.avatar_url,
              role: profile.role,
              created_at: profile.created_at,
              activity_summary: {
                total_files: totalFiles,
                total_size: totalSize,
                last_upload: lastUpload,
                favorite_tool: favoriteTool,
                projects_count: projectsSet.size,
                average_file_size:
                  totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0,
              },
            };
          })
        );

        return reply.send({
          success: true,
          data: {
            team: {
              id: team.id,
              name: team.name,
              description: team.description,
              member_count: profiles?.length || 0,
            },
            members: membersWithActivity,
          },
        });
      } catch (error) {
        request.log.error(error, "Get team members error");
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // GET /teams/current/members/{userId} - 팀 멤버 상세 통계
  fastify.get(
    "/current/members/:userId",
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const { userId } = request.params as { userId: string };
        const supabase = getSupabase();

        // 멤버 정보 확인 (같은 팀인지 검증)
        const { data: member, error: memberError } = (await supabase
          .from("profiles")
          .select("id, full_name, username, role, created_at")
          .eq("id", userId)
          .eq("team_id", user.team_id!)
          .single()) as { data: any; error: any };

        if (memberError || !member) {
          return reply.status(404).send({
            success: false,
            error: "Team member not found",
          });
        }

        // 멤버의 모든 세션 데이터 조회 (session_summary 기준)
        const { data: sessions, error: sessionsError } = (await supabase
          .from("session_summary")
          .select("*")
          .eq("user_id", userId)
          .order("session_date", { ascending: false })) as {
          data: any;
          error: any;
        };

        if (sessionsError) {
          request.log.error(sessionsError, "Failed to fetch member sessions");
          return reply.status(500).send({
            success: false,
            error: "Failed to fetch member activity data",
          });
        }

        // 상세 인사이트 계산 (session_summary 기준)
        request.log.info(
          { sessionCount: sessions?.length, sampleSession: sessions?.[0] },
          "Sessions data for insights calculation"
        );
        const insights = calculateMemberInsights(sessions || []);

        // 일별 카드 생성 (최근 30일, session_date 기준)
        const dailyCards = generateDailyCards(sessions || [], 30);

        return reply.send({
          success: true,
          data: {
            member: {
              id: member.id,
              full_name: member.full_name,
              username: member.username,
              role: member.role,
              joined_at: member.created_at,
            },
            insights,
            daily_cards: dailyCards,
          },
        });
      } catch (error) {
        request.log.error(error, "Get member details error");
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // GET /teams/current/members/{userId}/daily/{date} - 일별 세션 상세
  fastify.get(
    "/current/members/:userId/daily/:date",
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const { userId, date } = request.params as {
          userId: string;
          date: string;
        };
        const supabase = getSupabase();

        // 멤버 정보 확인
        const { data: member, error: memberError } = (await supabase
          .from("profiles")
          .select("id, full_name, username, role")
          .eq("id", userId)
          .eq("team_id", user.team_id!)
          .single()) as { data: any; error: any };

        if (memberError || !member) {
          return reply.status(404).send({
            success: false,
            error: "Team member not found",
          });
        }

        // 해당 날짜의 세션들 조회 (session_summary만 사용)
        const { data: sessions, error: sessionsError } = (await supabase
          .from("session_summary")
          .select("*")
          .eq("user_id", userId)
          .eq("session_date", date)
          .order("start_timestamp", { ascending: true })) as {
          data: any;
          error: any;
        };

        // 디버그 로깅
        request.log.info(
          {
            sessionCount: sessions?.length,
            sampleSession: sessions?.[0],
            date,
            userId,
          },
          "Sessions data fetched"
        );

        // session_summary.id로 session_content 조회
        let sessionContents: Record<string, any> = {};
        if (sessions?.length > 0) {
          const summaryIds = sessions.map((s: any) => s.id); // session_summary.id 사용

          const { data: contents } = (await supabase
            .from("session_content")
            .select("session_id, messages, message_count")
            .in("session_id", summaryIds)) as { data: any; error: any };

          sessionContents = (contents || []).reduce(
            (acc: Record<string, any>, content: any) => {
              acc[content.session_id] = content;
              return acc;
            },
            {}
          );

          request.log.info(
            {
              summaryIds: summaryIds.slice(0, 3),
              contentCount: contents?.length,
              contentKeys: Object.keys(sessionContents),
            },
            "Session contents fetched by summary ID"
          );
        }

        if (sessionsError) {
          request.log.error(sessionsError, "Failed to fetch daily sessions");
          return reply.status(500).send({
            success: false,
            error: "Failed to fetch daily sessions",
          });
        }

        // 일별 통계 계산
        const dailyStats = calculateDailyStats(sessions || [], date);

        // 세션 상세 정보 구성 (명시적 타입 지정)
        interface SessionDetail {
          id: string;
          session_id: string;
          project_name: string;
          duration_minutes: number;
          start_time: string;
          end_time: string;
          total_messages: number;
          prompt_count: number;
          total_tokens: number;
          total_input_tokens: number;
          total_output_tokens: number;
          working_directory: string;
          git_branch: string;
          model_names: string[];
          session_content: {
            messages: any[];
            message_count: number;
            has_content: boolean;
          };
        }

        const detailedSessions: SessionDetail[] = (sessions || []).map(
          (session: any) => {
            const content = sessionContents[session.id] || {}; // session_summary.id로 조회

            const sessionDetail: SessionDetail = {
              id: session.session_id,
              session_id: session.session_id,
              project_name: session.project_name || "unknown",
              duration_minutes: Number(session.duration_minutes) || 0,
              start_time: session.start_timestamp
                ? new Date(session.start_timestamp).toLocaleTimeString("ko-KR")
                : "",
              end_time: session.end_timestamp
                ? new Date(session.end_timestamp).toLocaleTimeString("ko-KR")
                : "",
              total_messages: Number(session.total_messages) || 0,
              prompt_count: Number(session.prompt_count) || 0,
              total_tokens: Number(session.total_tokens) || 0,
              total_input_tokens: Number(session.total_input_tokens) || 0,
              total_output_tokens: Number(session.total_output_tokens) || 0,
              working_directory: String(session.working_directory || ""),
              git_branch: String(session.git_branch || ""),
              model_names: Array.isArray(session.model_names)
                ? session.model_names
                : [],
              session_content: content.messages || null,
            };

            return sessionDetail;
          }
        );

        // 최종 응답 디버그
        request.log.info(
          {
            sessionsCount: detailedSessions.length,
            firstSession: detailedSessions[0],
            secondSession: detailedSessions[1],
          },
          "Actual session data being sent"
        );

        return reply.send({
          success: true,
          data: {
            date,
            member: {
              id: member.id,
              full_name: member.full_name,
              username: member.username,
              role: member.role,
            },
            daily_stats: dailyStats,
            sessions: detailedSessions,
          },
        });
      } catch (error) {
        request.log.error(error, "Get daily sessions error");
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // POST /teams/generate-summary - AI 요약 생성
  const generateSummarySchema = z.object({
    userId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    projectTexts: z
      .array(
        z.object({
          projectName: z.string(),
          userText: z.string(),
        })
      )
      .optional(),
    forceRegenerate: z.boolean().optional().default(false),
  });

  fastify.post(
    "/generate-summary",
    async function (request: FastifyRequest, reply) {
      try {
        const user = (request as AuthenticatedRequest).user;
        const { userId, date, projectTexts, forceRegenerate } =
          generateSummarySchema.parse(request.body);
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

        // 기존 요약 확인
        if (!forceRegenerate) {
          const { data: existingSummary } = (await supabase
            .from("daily_ai_summaries")
            .select("summary_text, created_at")
            .eq("user_id", userId)
            .eq("date", date)
            .single()) as { data: any };

          if (existingSummary) {
            // 기존 요약도 파싱하여 구조화된 데이터 제공
            const parsedData = parseSummaryMarkdown(
              existingSummary.summary_text
            );

            return reply.send({
              success: true,
              data: {
                summary: existingSummary.summary_text,
                cached: true,
                created_at: existingSummary.created_at,
                parsed_data: parsedData,
                daily_summary: parsedData.dailySummary,
                tasks_count: parsedData.totalTasks,
                category_breakdown: parsedData.categoryCounts,
                parse_errors: parsedData.errors,
              },
            });
          }
        }

        // 프로젝트 텍스트가 없으면 세션 데이터에서 추출
        let projectData = projectTexts || [];
        if (!projectTexts || projectTexts.length === 0) {
          // session_summary에서 해당 날짜 데이터 조회
          const { data: sessions } = (await supabase
            .from("session_summary")
            .select("id, session_id, project_name")
            .eq("user_id", userId)
            .eq("session_date", date)) as { data: any };

          request.log.info(
            {
              sessionsFound: sessions?.length || 0,
              sampleSession: sessions?.[0],
              userId,
              date,
            },
            "Session summary data for AI summary generation"
          );

          if (!sessions || sessions.length === 0) {
            return reply.send({
              success: true,
              data: {
                summary: "이 날짜에는 작업한 내용이 없습니다.",
                cached: false,
              },
            });
          }

          // session_content에서 사용자 메시지 추출
          const sessionIds = sessions.map((s: any) => s.id);
          const { data: contents } = (await supabase
            .from("session_content")
            .select("session_id, messages")
            .in("session_id", sessionIds)) as { data: any };

          request.log.info(
            {
              contentFound: contents?.length || 0,
              sessionIds: sessionIds.slice(0, 3),
            },
            "Session content data for AI summary generation"
          );

          // 프로젝트별로 사용자 메시지 그룹화
          const projectGroups: Record<string, string[]> = {};

          contents?.forEach((content: any) => {
            const session = sessions.find(
              (s: any) => s.id === content.session_id
            );
            const projectName = session?.project_name || "unknown";

            if (!projectGroups[projectName]) {
              projectGroups[projectName] = [];
            }

            // messages.messages 배열에서 user type 메시지만 추출
            const userMessages =
              content.messages?.messages
                ?.filter((msg: any) => msg.type === "user")
                ?.map((msg: any) => msg.content)
                ?.filter((content: any) => typeof content === "string") || [];

            request.log.info(
              {
                sessionId: content.session_id,
                projectName,
                userMessageCount: userMessages.length,
                sampleMessage: userMessages[0]?.substring(0, 100),
              },
              "Processing session content for project"
            );

            projectGroups[projectName].push(...userMessages);
          });

          // projectTexts 형태로 변환
          projectData = Object.entries(projectGroups).map(
            ([projectName, texts]) => ({
              projectName,
              userText: texts.join("\n\n"),
            })
          );

          request.log.info(
            {
              projectGroups: Object.keys(projectGroups),
              projectDataCount: projectData.length,
              totalTextsLength: projectData.reduce(
                (sum, p) => sum + p.userText.length,
                0
              ),
            },
            "Project data extracted for AI summary"
          );
        }

        if (projectData.length === 0) {
          return reply.send({
            success: true,
            data: {
              summary: "이 날짜에는 작업한 내용이 없습니다.",
              cached: false,
            },
          });
        }

        // Claude 프롬프트 생성
        let analysisPrompt = `
다음은 한 사용자가 ${date} 날짜에 프로젝트별로 작성한 모든 사용자 메시지들입니다:

${projectData
  .map((project: any) => {
    const messages = project.userText
      .split("\n\n")
      .filter((text: string) => text.trim().length > 0);
    const totalLength = project.userText.length;
    const messageCount = messages.length;

    return `
## 프로젝트: ${project.projectName}
총 ${messageCount}개 프롬프트, 총 ${totalLength}자

${project.userText}
`;
  })
  .join("\n")}`;

        // 프롬프트 길이 제한 (150k 문자)
        const MAX_CHARS = 150000;
        if (analysisPrompt.length > MAX_CHARS) {
          analysisPrompt =
            analysisPrompt.substring(0, MAX_CHARS) +
            "\n\n... (텍스트가 잘렸습니다)";
        }

        analysisPrompt += `

위 메시지들을 분석해서 다음 형태로 응답해주세요:

## 📝 오늘의 업무 요약
[사용자가 오늘 진행한 핵심 업무들을 500자 이내로 간결하게 요약해주세요. 주요 성과와 작업한 프로젝트들, 해결한 문제들을 중심으로 서술]

## ✅ 완료한 작업 목록

${projectData
  .map(
    (project: any) => `### 프로젝트: ${project.projectName}
- [ ] [해당 프로젝트에서 완료한 구체적인 작업 항목들]`
  )
  .join("\n\n")}

**작업 분석 지침:**
1. 각 프롬프트에서 실제로 요청하거나 작업한 구체적인 내용을 추출
2. "API 엔드포인트 구현", "버그 수정", "UI 컴포넌트 개발" 등 명확한 작업 단위로 표현
3. 하나의 작업을 완료하는데 사용된 프롬프트 횟수와 작업 분류, 예상 소요시간을 분석
4. 체크박스(- [ ]) 형태로 TODO 리스트 작성
5. 각 작업 뒤에 **(프롬프트 N회, 카테고리, 예상시간)** 형태로 메타데이터 추가
6. 한국어로 작성하되, 기술 용어는 그대로 유지

**작업 카테고리:**
- 기능구현: 새로운 기능이나 API 개발
- 버그수정: 오류나 문제점 해결  
- 리팩토링: 코드 구조나 성능 개선
- UI개선: 사용자 인터페이스 수정
- 문서작업: 문서화나 주석 작성
- 설정작업: 환경설정이나 도구 설정
- 테스트: 테스트 코드 작성이나 검증

**응답 예시:**
- [ ] 사용자 인증 API 엔드포인트 구현 (프롬프트 5회)
- [ ] 데이터베이스 연결 오류 수정 (프롬프트 2회)  
- [ ] 대시보드 레이아웃 개선 (프롬프트 3회)
- [ ] API 문서 업데이트 (프롬프트 1회)
`;

        // Claude API 호출
        request.log.info(
          { promptLength: analysisPrompt.length, userId, date },
          "Generating AI summary"
        );
        const summary = await generateWithClaude(analysisPrompt);

        // 마크다운 파싱
        const parsedData = parseSummaryMarkdown(summary);
        const serializedParsedData = serializeParsedData(parsedData);

        request.log.info(
          {
            totalTasks: parsedData.totalTasks,
            projectCount: parsedData.tasksByProject.length,
            parseSuccess: parsedData.parseSuccess,
            errors: parsedData.errors,
          },
          "Summary parsing completed"
        );

        // DB에 저장 (parsed_data와 daily_summary 저장)
        const { error: saveError } = await supabase
          .from("daily_ai_summaries")
          .upsert({
            user_id: userId,
            date,
            summary_text: summary,
            project_texts: projectData,
            force_regenerated: forceRegenerate,
            parsed_data: JSON.parse(serializedParsedData),
            daily_summary: parsedData.dailySummary
          } as any);

        if (saveError) {
          request.log.error(saveError, "Failed to save AI summary");
          // 저장 실패해도 생성된 요약은 반환
        }

        return reply.send({
          success: true,
          data: {
            summary,
            cached: false,
            project_count: projectData.length,
            parsed_data: parsedData,
            daily_summary: parsedData.dailySummary,
            tasks_count: parsedData.totalTasks,
            category_breakdown: parsedData.categoryCounts,
            parse_errors: parsedData.errors,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Invalid input",
            details: error.issues,
          });
        }

        request.log.error(error, "Generate summary error");
        return reply.status(500).send({
          success: false,
          error: "Failed to generate summary",
        });
      }
    }
  );
}

// 멤버 인사이트 계산 함수 (session_summary 기준)
function calculateMemberInsights(sessions: any[]) {
  console.log(
    "calculateMemberInsights called with:",
    sessions.length,
    "sessions"
  );

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 기본 통계
  const totalSessions = sessions.length;
  const totalTokens = sessions.reduce(
    (sum, session) => sum + (session.total_tokens || 0),
    0
  );
  const totalDuration = sessions.reduce(
    (sum, session) => sum + (session.duration_minutes || 0),
    0
  );

  console.log("Basic stats:", { totalSessions, totalTokens, totalDuration });

  // 프로젝트별 사용량
  const projectUsage = sessions.reduce(
    (acc: Record<string, number>, session) => {
      const project = session.project_name || "unknown";
      acc[project] = (acc[project] || 0) + 1;
      return acc;
    },
    {}
  );

  // 시간대별 활동 (24시간)
  const hourlyActivity = sessions.reduce(
    (acc: Record<number, number>, session) => {
      if (session.start_timestamp) {
        const hour = new Date(session.start_timestamp).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
      }
      return acc;
    },
    {}
  );

  // 가장 활발한 시간대
  const peakHours = Object.entries(hourlyActivity)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([hour]) => `${hour}시`);

  // 요일별 활동
  const weekdayActivity = sessions.reduce(
    (acc: Record<number, number>, session) => {
      if (session.session_date) {
        const weekday = new Date(session.session_date).getDay();
        acc[weekday] = (acc[weekday] || 0) + 1;
      }
      return acc;
    },
    {}
  );

  // 최근 30일 활동
  const recentSessions = sessions.filter(
    (session) =>
      session.session_date && new Date(session.session_date) > thirtyDaysAgo
  );

  // 연속 활동 일수 계산
  const activityDates = [
    ...new Set(sessions.map((session) => session.session_date)),
  ]
    .filter(Boolean)
    .sort();

  let streakDays = 0;
  const currentDate = new Date();
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(currentDate);
    checkDate.setDate(currentDate.getDate() - i);
    const dateStr = checkDate.toISOString().split("T")[0];

    if (activityDates.includes(dateStr)) {
      streakDays++;
    } else if (i > 0) {
      break;
    }
  }

  return {
    overview: {
      total_sessions: totalSessions,
      total_tokens: totalTokens,
      total_duration_minutes: totalDuration,
      average_tokens:
        totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0,
      recent_activity: recentSessions.length,
      activity_percentage:
        totalSessions > 0
          ? Math.round((recentSessions.length / totalSessions) * 100)
          : 0,
    },
    patterns: {
      favorite_projects: Object.entries(projectUsage)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([project, count]) => ({ project, count })),
      peak_hours: peakHours,
      most_active_weekday: getDayName(
        Object.entries(weekdayActivity).sort(
          ([, a], [, b]) => (b as number) - (a as number)
        )[0]?.[0]
      ),
      current_streak: streakDays,
    },
    productivity: {
      daily_average:
        totalSessions > 0
          ? totalSessions / Math.max(1, activityDates.length)
          : 0,
      token_efficiency: totalTokens / Math.max(1, totalSessions),
      consistency_score: calculateConsistencyScore(activityDates),
      recent_trend: calculateTrend(recentSessions),
    },
    milestones: {
      first_session:
        sessions.length > 0 ? sessions[sessions.length - 1].session_date : null,
      longest_session: sessions.reduce(
        (max, session) =>
          (session.duration_minutes || 0) > (max?.duration_minutes || 0)
            ? session
            : max,
        null
      ),
      most_productive_day: getMostProductiveDay(sessions),
      total_projects: [
        ...new Set(
          sessions.map((session) => session.project_name || "unknown")
        ),
      ].length,
    },
  };
}

// 일별 카드 생성 함수 (session_summary 기준)
function generateDailyCards(sessions: any[], days: number) {
  const cards: Record<string, any> = {};

  // 날짜별로 세션 그룹화
  sessions.forEach((session) => {
    const date = session.session_date;
    if (!date) return;

    if (!cards[date]) {
      cards[date] = {
        date,
        sessions: [],
        projects: new Set(),
        total_tokens: 0,
        total_duration: 0,
        hours: new Set(),
      };
    }

    cards[date].sessions.push(session);
    cards[date].projects.add(session.project_name || "unknown");
    cards[date].total_tokens += session.total_tokens || 0;
    cards[date].total_duration += session.duration_minutes || 0;
    if (session.start_timestamp) {
      cards[date].hours.add(new Date(session.start_timestamp).getHours());
    }
  });

  // 카드 형태로 변환
  return Object.values(cards)
    .map((card: any) => ({
      date: card.date,
      session_count: card.sessions.length,
      total_tokens: card.total_tokens,
      total_duration: card.total_duration,
      average_tokens:
        card.sessions.length > 0
          ? Math.round(card.total_tokens / card.sessions.length)
          : 0,
      projects_used: Array.from(card.projects),
      active_hours: Array.from(card.hours)
        .sort()
        .map((h) => `${h}시`),
      projects: Array.from(card.projects),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, days);
}

// 일별 통계 계산 함수 (session_summary 기준)
function calculateDailyStats(sessions: any[], _date: string) {
  const totalSessions = sessions.length;
  const totalTokens = sessions.reduce(
    (sum, s) => sum + (s.total_tokens || 0),
    0
  );
  const totalMessages = sessions.reduce(
    (sum, s) => sum + (s.total_messages || 0),
    0
  );
  const totalDuration = sessions.reduce(
    (sum, s) => sum + (s.duration_minutes || 0),
    0
  );

  const projectUsage = sessions.reduce(
    (acc: Record<string, number>, session) => {
      const project = session.project_name || "unknown";
      acc[project] = (acc[project] || 0) + 1;
      return acc;
    },
    {}
  );

  const hourlyDistribution = sessions.reduce(
    (acc: Record<number, number>, session) => {
      if (session.start_timestamp) {
        const hour = new Date(session.start_timestamp).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
      }
      return acc;
    },
    {}
  );

  const projects = [
    ...new Set(sessions.map((session) => session.project_name || "unknown")),
  ];

  const modelNames = [
    ...new Set(sessions.flatMap((session) => session.model_names || [])),
  ];

  return {
    overview: {
      total_sessions: totalSessions,
      total_tokens: totalTokens,
      total_messages: totalMessages,
      total_duration_minutes: totalDuration,
      average_tokens:
        totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0,
      average_duration:
        totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0,
      unique_projects: projects.length,
    },
    projects: projectUsage,
    hourly_distribution: hourlyDistribution,
    project_list: projects,
    models_used: modelNames,
    time_span: {
      first_session: sessions.length > 0 ? sessions[0].start_timestamp : null,
      last_session:
        sessions.length > 0
          ? sessions[sessions.length - 1].end_timestamp
          : null,
    },
  };
}

// 헬퍼 함수들
function getDayName(dayNumber: string | undefined): string {
  if (!dayNumber) return "Unknown";
  const days = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ];
  return days[parseInt(dayNumber)] || "Unknown";
}

function calculateConsistencyScore(dates: string[]): number {
  if (dates.length < 2) return 0;

  const gaps = [];
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] || "");
    const current = new Date(dates[i] || "");
    const gap =
      Math.abs(current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(gap);
  }

  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  return Math.max(0, Math.min(100, 100 - avgGap * 5)); // 일 단위 간격에 따른 점수
}

function calculateTrend(
  recentFiles: any[]
): "increasing" | "decreasing" | "stable" {
  if (recentFiles.length < 4) return "stable";

  const half = Math.floor(recentFiles.length / 2);
  const firstHalf = recentFiles.slice(-half);
  const secondHalf = recentFiles.slice(0, half);

  const firstAvg = firstHalf.length;
  const secondAvg = secondHalf.length;

  if (secondAvg > firstAvg * 1.2) return "increasing";
  if (secondAvg < firstAvg * 0.8) return "decreasing";
  return "stable";
}

function getMostProductiveDay(
  files: any[]
): { date: string; sessions: number; size: number } | null {
  if (files.length === 0) return null;

  const dailyData = files.reduce((acc: Record<string, any>, file) => {
    const date = file.created_at.split("T")[0];
    if (!acc[date]) {
      acc[date] = { date, sessions: 0, size: 0 };
    }
    acc[date].sessions += 1;
    acc[date].size += file.file_size || 0;
    return acc;
  }, {});

  return (
    (Object.values(dailyData).sort(
      (a: any, b: any) => b.sessions - a.sessions
    )[0] as any) || null
  );
}
