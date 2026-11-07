#include "vectordb/rag_eval.hpp"
#include "vectordb/rag.hpp"
#include "vectordb/ollama_client.hpp"

#include <nlohmann/json.hpp>
#include <fstream>
#include <iostream>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>
#include <filesystem>

using json = nlohmann::json;
using namespace vectordb;

int main(int argc, char* argv[]) {
    std::string questionsPath;
    std::string docPath;
    RagPromptVersion promptVer = RagPromptVersion::V2;
    std::size_t k = 4;
    std::string outCsv;
    std::string ollamaUrl = "http://127.0.0.1:11434";
    std::string embedModel = "nomic-embed-text";
    std::string chatModel = "llama3.2";

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--questions" && i + 1 < argc) {
            questionsPath = argv[++i];
        } else if (arg == "--doc" && i + 1 < argc) {
            docPath = argv[++i];
        } else if (arg == "--prompt" && i + 1 < argc) {
            promptVer = ragPromptVersionFromString(argv[++i]);
        } else if (arg == "--k" && i + 1 < argc) {
            k = std::stoull(argv[++i]);
        } else if (arg == "--out" && i + 1 < argc) {
            outCsv = argv[++i];
        } else if (arg == "--ollama-url" && i + 1 < argc) {
            ollamaUrl = argv[++i];
        } else if (arg == "--embed-model" && i + 1 < argc) {
            embedModel = argv[++i];
        } else if (arg == "--chat-model" && i + 1 < argc) {
            chatModel = argv[++i];
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: vectordb_rag_eval --questions <file> --doc <file> --prompt v1|v2|v3 [--k 4] [--out <csv>]\n";
            return 0;
        }
    }

    if (questionsPath.empty() || docPath.empty()) {
        std::cerr << "Error: --questions and --doc are required\n";
        return 1;
    }

    // 1. Load questions
    std::ifstream qFile(questionsPath);
    if (!qFile.is_open()) {
        std::cerr << "Error: Cannot open questions file: " << questionsPath << "\n";
        return 1;
    }
    json qJson;
    try {
        qFile >> qJson;
    } catch (const std::exception& e) {
        std::cerr << "Error parsing questions JSON: " << e.what() << "\n";
        return 1;
    }

    std::vector<EvalQuestion> questions;
    for (const auto& item : qJson) {
        EvalQuestion q;
        q.id = item.value("id", "");
        q.question = item.value("question", "");
        q.answerable = item.value("answerable", false);
        if (item.contains("expect_any")) {
            for (const auto& e : item["expect_any"]) {
                q.expectAny.push_back(e.get<std::string>());
            }
        }
        if (item.contains("forbid_any")) {
            for (const auto& f : item["forbid_any"]) {
                q.forbidAny.push_back(f.get<std::string>());
            }
        }
        questions.push_back(std::move(q));
    }

    // 2. Read document text
    std::ifstream dFile(docPath);
    if (!dFile.is_open()) {
        std::cerr << "Error: Cannot open document file: " << docPath << "\n";
        return 1;
    }
    std::stringstream docBuffer;
    docBuffer << dFile.rdbuf();
    std::string docText = docBuffer.str();

    // 3. Initialize OllamaClient and RagPipeline
    OllamaConfig oCfg;
    oCfg.baseUrl = ollamaUrl;
    oCfg.embedModel = embedModel;
    oCfg.chatModel = chatModel;
    OllamaClient ollama(oCfg);

    RagConfig rCfg;
    rCfg.dimension = 768;
    rCfg.metric = Metric::Cosine;
    rCfg.promptVersion = promptVer;
    RagPipeline rag(rCfg, ollama);

    // 4. Ingest document
    std::string docTitle = std::filesystem::path(docPath).filename().string();
    auto ingestRes = rag.ingest(docTitle, docText);
    std::cout << "Ingested document '" << docTitle << "' (" << ingestRes.chunkCount
              << " chunks, embed: " << ingestRes.embedMs << " ms)\n";
    std::cout << "Prompt Version : " << ragPromptVersionToString(promptVer) << "\n";
    std::cout << "Evaluating " << questions.size() << " questions...\n\n";

    // 5. Evaluate each question
    struct RowResult {
        std::string id;
        bool answerable;
        bool correct;
        float topSim;
        double generateMs;
        std::string answer;
    };

    std::vector<RowResult> results;
    ChatOptions chatOpt;
    chatOpt.temperature = 0.0;
    chatOpt.seed = 42;

    std::size_t totalAnswerable = 0;
    std::size_t correctAnswerable = 0;
    std::size_t totalUnanswerable = 0;
    std::size_t correctUnanswerable = 0;
    std::size_t shortAnswersCount = 0;

    for (const auto& q : questions) {
        AskResult askRes = rag.ask(q.question, k, Algorithm::Hnsw, std::nullopt, chatOpt, false);
        bool isCorrect = scoreRagAnswer(q, askRes.answer);
        float topSim = askRes.sources.empty() ? 0.0f : askRes.sources.front().similarity;

        if (q.answerable) {
            totalAnswerable++;
            if (isCorrect) correctAnswerable++;
        } else {
            totalUnanswerable++;
            if (isCorrect) correctUnanswerable++;
        }

        if (askRes.answer.size() < 20) {
            shortAnswersCount++;
        }

        results.push_back(RowResult{
            q.id,
            q.answerable,
            isCorrect,
            topSim,
            askRes.timings.generateMs,
            askRes.answer
        });
    }

    // Print Console Table
    std::cout << std::string(110, '-') << "\n";
    std::cout << std::left << std::setw(6) << "ID"
              << std::setw(12) << "Answerable"
              << std::setw(10) << "Correct"
              << std::setw(10) << "Top Sim"
              << std::setw(12) << "Gen (ms)"
              << "First 120 chars of Answer\n";
    std::cout << std::string(110, '-') << "\n";

    for (const auto& r : results) {
        std::string cleanAns;
        for (char c : r.answer) {
            if (c == '\n' || c == '\r') cleanAns += ' ';
            else cleanAns += c;
        }
        std::string preview = cleanAns.substr(0, 120);

        std::cout << std::left << std::setw(6) << r.id
                  << std::setw(12) << (r.answerable ? "true" : "false")
                  << std::setw(10) << (r.correct ? "PASS" : "FAIL")
                  << std::setw(10) << std::fixed << std::setprecision(4) << r.topSim
                  << std::setw(12) << std::fixed << std::setprecision(1) << r.generateMs
                  << preview << "\n";
    }
    std::cout << std::string(110, '-') << "\n\n";

    // Print Totals
    std::cout << "Evaluation Summary (" << ragPromptVersionToString(promptVer) << "):\n";
    double ansAcc = totalAnswerable > 0 ? (100.0 * static_cast<double>(correctAnswerable) / static_cast<double>(totalAnswerable)) : 0.0;
    std::cout << "  Answerable Accuracy : " << correctAnswerable << " / " << totalAnswerable
              << " (" << std::fixed << std::setprecision(1) << ansAcc << "%)\n";

    double refAcc = totalUnanswerable > 0 ? (100.0 * static_cast<double>(correctUnanswerable) / static_cast<double>(totalUnanswerable)) : 0.0;
    std::cout << "  Refusal Accuracy    : " << correctUnanswerable << " / " << totalUnanswerable
              << " (" << std::fixed << std::setprecision(1) << refAcc << "%)\n";

    std::cout << "  Short Answers (<20) : " << shortAnswersCount << " / " << results.size() << "\n\n";

    // Write CSV if requested
    if (!outCsv.empty()) {
        std::filesystem::path outPath(outCsv);
        if (outPath.has_parent_path()) {
            std::filesystem::create_directories(outPath.parent_path());
        }
        std::ofstream csv(outCsv);
        if (csv.is_open()) {
            csv << "id,answerable,correct,top_similarity,generate_ms,answer_length,answer\n";
            for (const auto& r : results) {
                csv << r.id << ","
                    << (r.answerable ? "true" : "false") << ","
                    << (r.correct ? "PASS" : "FAIL") << ","
                    << std::fixed << std::setprecision(4) << r.topSim << ","
                    << std::fixed << std::setprecision(1) << r.generateMs << ","
                    << r.answer.size() << ",";
                // CSV escape answer
                std::string escaped = "\"";
                for (char c : r.answer) {
                    if (c == '"') escaped += "\"\"";
                    else escaped += c;
                }
                escaped += "\"";
                csv << escaped << "\n";
            }
            std::cout << "Wrote CSV report to: " << outCsv << "\n";
        } else {
            std::cerr << "Warning: Could not open " << outCsv << " for writing\n";
        }
    }

    return 0;
}
