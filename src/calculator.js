export const DEFAULT_INPUTS = {
  // General / Currency
  currency: "USD",
  exchangeRate: 95.32,

  // 1. Document Processing
  documents: 500,
  pagesPerDoc: 10,
  wordsPerPage: 400,
  ocrPercent: 20, 
  ocrProvider: "AWS Textract",
  ocrRatePerPage: 0.015, 
  parserUsed: "LlamaParse", 
  parserRatePerPage: 0.003, 
  avgImagesPerDoc: 2,
  avgTablesPerDoc: 1,
  tableExtractionRate: 0.02, 
  imageExtractionRate: 0.01, 
  monthlyNewDocs: 10,
  monthlyDeletedDocs: 2,

  // 2. Chunking Strategy
  chunkSize: 512, 
  chunkOverlap: 50, 
  recursiveSplitter: true,
  semanticSplitter: false,
  metadataSize: 128, 
  duplicatePercent: 5, 

  // 3. Embedding Layer
  embeddingModel: "Titan Text V2", 
  embeddingBatchSize: 2048,
  embeddingCachePercent: 15,
  reEmbeddingFrequencyMonths: 12,
  avgQueryTokens: 1000, 

  // 4. Storage Layer
  vectorDb: "AWS RDS pgvector (db.t4g.medium)", 
  replicationFactor: 1,
  dbMonthlyReads: 150000, 
  dbMonthlyWrites: 1000,

  // 5. Retrieval Pipeline
  topK: 10,
  initialCandidateCount: 50, 
  metadataFiltering: true,
  hybridSearch: true,
  bm25Enabled: true,
  vectorSearchEnabled: true,
  hybridFusionWeight: 0.5,

  // 6. Reranking Layer
  rerankerModel: "Cohere Rerank v3", 
  topKBeforeRerank: 30,
  topKAfterRerank: 5,

  // 7. Context Construction
  systemPromptTokens: 500,
  conversationHistoryTokens: 1200,
  avgTurnsPerSession: 4,

  // 8. Context Compression
  compressionEnabled: false,
  compressionModel: "Claude 3.5 Haiku",
  compressionRate: 35, 

  // 9. Generation Layer
  llmModel: "Claude 3.5 Sonnet", 
  avgReasoningTokens: 0,
  avgOutputTokens: 800,
  streamingEnabled: true,

  // 10. Agentic Workflow
  workflowCallsPerQuery: 1, 

  // 11. Model Routing
  routingEnabled: false,
  routingMiniPercent: 70, 
  routingLargePercent: 30, 
  llmModelMini: "GPT-4o mini",
  llmModelLarge: "Claude 3.5 Sonnet",

  // 12. Caching
  semanticCacheHitPercent: 10,
  promptCacheHitPercent: 20,

  // 13. Safety Layer
  moderationEnabled: true,
  moderationRatePer1M: 0.15, 
  piiDetectionEnabled: false,
  piiRatePer1M: 1.00,

  // 14. Infrastructure
  infraAppServers: 2,
  infraAppServerMonthlyRate: 20.00, 
  infraGpuNodes: 0,
  infraGpuNodeMonthlyRate: 350.00,
  infraLoadBalancers: 1,
  infraLoadBalancerMonthlyRate: 15.00,
  infraRedisNodes: 1,
  infraRedisMonthlyRate: 15.00,
  infraBandwidthGb: 100,
  infraBandwidthMonthlyRate: 0.08, 
  infraMonitoringMonthlyCost: 15.00,

  // 15. Operational Costs
  opsEngineerSalary: 120000, 
  opsDedicatedFteCount: 0.1, 
  opsPromptEngineeringMonthlyHours: 10,
  opsConsultingHourlyRate: 75.00,
  opsHumanEvaluationMonthlyCost: 50.00,

  // Build vs Buy parameters
  hardwareDepreciationYears: 3,
  powerConsumptionKw: 0.5,
  powerCostPerKwh: 0.12,
  coolingPue: 1.2
};

export function calculateTco(inputs, catalog, monthlyActiveUsers = null) {
  // Override MAU for sensitivity tiers
  const activeUsers = monthlyActiveUsers !== null ? monthlyActiveUsers : inputs.monthlyActiveUsers || 10000;
  
  // Exchange rate helper
  const isINR = inputs.currency === "INR";
  const multiplier = isINR ? inputs.exchangeRate : 1.0;

  // Lookups
  const selectedLlm = catalog.llm_models.find(m => m.name === inputs.llmModel) || catalog.llm_models[0];
  const selectedLlmMini = catalog.llm_models.find(m => m.name === inputs.llmModelMini) || catalog.llm_models[0];
  const selectedLlmLarge = catalog.llm_models.find(m => m.name === inputs.llmModelLarge) || catalog.llm_models[0];
  
  const selectedEmbed = catalog.embedding_models.find(m => m.name === inputs.embeddingModel) || catalog.embedding_models[0];
  const selectedRerank = catalog.reranker_models.find(m => m.name === inputs.rerankerModel) || catalog.reranker_models[0];
  const selectedDb = catalog.vector_databases.find(m => m.name === inputs.vectorDb) || catalog.vector_databases[0];

  // Base sizing
  const totalPages = inputs.documents * inputs.pagesPerDoc;
  const ocrPages = totalPages * (inputs.ocrPercent / 100);
  const parsedPages = totalPages - ocrPages;

  // 1. Document Processing Cost
  const ocrCost = ocrPages * inputs.ocrRatePerPage;
  const parsingCost = parsedPages * inputs.parserRatePerPage;
  const tableCost = inputs.documents * inputs.avgTablesPerDoc * inputs.tableExtractionRate;
  const imageCost = inputs.documents * inputs.avgImagesPerDoc * inputs.imageExtractionRate;
  const initialDocProcessingCostUsd = ocrCost + parsingCost + tableCost + imageCost;
  
  // Monthly updates doc processing
  const monthlyNewPages = inputs.monthlyNewDocs * inputs.pagesPerDoc;
  const monthlyOcrPages = monthlyNewPages * (inputs.ocrPercent / 100);
  const monthlyParsedPages = monthlyNewPages - monthlyOcrPages;
  const monthlyOcrCost = monthlyOcrPages * inputs.ocrRatePerPage;
  const monthlyParsingCost = monthlyParsedPages * inputs.parserRatePerPage;
  const monthlyTableCost = inputs.monthlyNewDocs * inputs.avgTablesPerDoc * inputs.tableExtractionRate;
  const monthlyImageCost = inputs.monthlyNewDocs * inputs.avgImagesPerDoc * inputs.imageExtractionRate;
  const monthlyDocProcessingCostUsd = monthlyOcrCost + monthlyParsingCost + monthlyTableCost + monthlyImageCost;

  // 2. Chunking Strategy
  const totalWords = totalPages * inputs.wordsPerPage;
  const initialTokens = totalWords * 1.33;
  const overlapRatio = inputs.chunkOverlap / inputs.chunkSize;
  
  // expected chunks per doc
  const rawChunksPerDoc = (initialTokens / Math.max(inputs.documents, 1)) / (inputs.chunkSize * (1 - overlapRatio));
  const duplicateMultiplier = 1 + (inputs.duplicatePercent / 100);
  const totalVectors = Math.round(inputs.documents * rawChunksPerDoc * duplicateMultiplier);
  const monthlyNewVectors = Math.round(inputs.monthlyNewDocs * rawChunksPerDoc * duplicateMultiplier);
  
  // Storage sizes in GB
  const dimensionBytes = selectedEmbed.dimensions * 4; 
  const metadataBytes = inputs.metadataSize;
  const indexOverhead = 1.35; 
  const initialIndexSizeGb = (totalVectors * (dimensionBytes + metadataBytes) * indexOverhead) / 1073741824;
  const monthlyIndexGrowthGb = (monthlyNewVectors * (dimensionBytes + metadataBytes) * indexOverhead) / 1073741824;

  // 3. Embedding Cost
  const initialEmbeddingCostUsd = (totalVectors * inputs.chunkSize / 1000000) * selectedEmbed.cost;
  const monthlyNewEmbeddingsCostUsd = (monthlyNewVectors * inputs.chunkSize / 1000000) * selectedEmbed.cost;
  
  const monthlyQueries = activeUsers * inputs.avgQueriesPerUserMonth;
  const queryEmbeddingCostUsd = (monthlyQueries * inputs.avgQueryTokens / 1000000) * selectedEmbed.cost;

  // 4. Vector DB Storage Cost
  let dbStorageCostUsd = 0;
  let dbOperationsCostUsd = 0;
  
  if (selectedDb.pricing_type === "serverless") {
    dbStorageCostUsd = initialIndexSizeGb * selectedDb.storage_cost;
    dbOperationsCostUsd = (monthlyQueries * selectedDb.read_cost / 1000000) + (monthlyNewVectors * selectedDb.write_cost / 1000000);
  } else if (selectedDb.pricing_type === "provisioned") {
    dbStorageCostUsd = selectedDb.node_rate * 730 * selectedDb.min_nodes;
  } else if (selectedDb.pricing_type === "flat_monthly") {
    dbStorageCostUsd = selectedDb.flat_rate;
  }
  
  const totalDbCostUsd = dbStorageCostUsd + dbOperationsCostUsd;

  // 5. Retrieval Pipeline Cost
  const retrievalPipelineCostUsd = inputs.metadataFiltering ? (monthlyQueries * 0.00001) : 0; 

  // 6. Reranking Layer Cost
  const rerankCostUsd = selectedRerank.cost > 0 
    ? (monthlyQueries * (1 - inputs.semanticCacheHitPercent / 100) * selectedRerank.cost / 1000)
    : 0;

  // 7. Context Construction
  const avgRetrievedChunksTokens = inputs.topK * inputs.chunkSize;
  const avgHistoryTokens = inputs.conversationHistoryTokens;
  const avgSystemTokens = inputs.systemPromptTokens;
  const avgMetadataTokens = inputs.topK * 150; 
  const rawLlmInputTokens = avgSystemTokens + avgHistoryTokens + avgRetrievedChunksTokens + avgMetadataTokens + inputs.avgQueryTokens;
  
  // 8. Context Compression
  let compressedLlmInputTokens = rawLlmInputTokens;
  let compressionCostUsd = 0;
  
  if (inputs.compressionEnabled) {
    const tokensToCompress = avgRetrievedChunksTokens;
    const compressionModel = catalog.llm_models.find(m => m.name === inputs.compressionModel) || selectedLlm;
    compressionCostUsd = (monthlyQueries * tokensToCompress / 1000000) * compressionModel.input_cost;
    const reducedTokens = tokensToCompress * (1 - inputs.compressionRate / 100);
    compressedLlmInputTokens = avgSystemTokens + avgHistoryTokens + reducedTokens + avgMetadataTokens + inputs.avgQueryTokens;
  }

  // 9. Generation Layer
  let selectedInputRate = selectedLlm.input_cost;
  let selectedOutputRate = selectedLlm.output_cost;
  
  if (inputs.routingEnabled) {
    const miniWeight = inputs.routingMiniPercent / 100;
    const largeWeight = inputs.routingLargePercent / 100;
    selectedInputRate = selectedLlmMini.input_cost * miniWeight + selectedLlmLarge.input_cost * largeWeight;
    selectedOutputRate = selectedLlmMini.output_cost * miniWeight + selectedLlmLarge.output_cost * largeWeight;
  }

  const promptCacheFactor = 1 - (inputs.promptCacheHitPercent / 100) * 0.5; 
  const effectiveLlmInputTokens = compressedLlmInputTokens * promptCacheFactor;
  const invocationsPerQuery = inputs.workflowCallsPerQuery;
  const effectiveQueries = monthlyQueries * (1 - inputs.semanticCacheHitPercent / 100);

  const monthlyLlmInputTokens = effectiveQueries * effectiveLlmInputTokens * invocationsPerQuery;
  const monthlyLlmOutputTokens = effectiveQueries * (inputs.avgOutputTokens + inputs.avgReasoningTokens) * invocationsPerQuery;
  
  const llmInputCostUsd = (monthlyLlmInputTokens / 1000000) * selectedInputRate;
  const llmOutputCostUsd = (monthlyLlmOutputTokens / 1000000) * selectedOutputRate;
  const totalLlmCostUsd = llmInputCostUsd + llmOutputCostUsd;

  // 13. Safety Layer
  const safetyCostUsd = inputs.moderationEnabled 
    ? (effectiveQueries * (effectiveLlmInputTokens + inputs.avgOutputTokens) / 1000000) * inputs.moderationRatePer1M
    : 0;

  // 14. Infrastructure Cost
  const serverCost = inputs.infraAppServers * inputs.infraAppServerMonthlyRate;
  const gpuCost = inputs.infraGpuNodes * inputs.infraGpuNodeMonthlyRate;
  const lbCost = inputs.infraLoadBalancers * inputs.infraLoadBalancerMonthlyRate;
  const redisCost = inputs.infraRedisNodes * inputs.infraRedisMonthlyRate;
  const networkCost = inputs.infraBandwidthGb * inputs.infraBandwidthMonthlyRate;
  const totalInfraCostUsd = serverCost + gpuCost + lbCost + redisCost + networkCost + inputs.infraMonitoringMonthlyCost;

  // 15. Operational Costs
  const opsEngineerMonthlySalary = inputs.opsEngineerSalary / 12;
  const allocatedEngCost = opsEngineerMonthlySalary * inputs.opsDedicatedFteCount;
  const promptTuningCost = inputs.opsPromptEngineeringMonthlyHours * inputs.opsConsultingHourlyRate;
  const totalOpsCostUsd = allocatedEngCost + promptTuningCost + inputs.opsHumanEvaluationMonthlyCost;

  // Ingestion totals
  const totalInitialIngestionCostUsd = initialDocProcessingCostUsd + initialEmbeddingCostUsd;
  
  // Monthly running totals
  const totalMonthlyRunningCostUsd = 
    monthlyDocProcessingCostUsd +
    monthlyNewEmbeddingsCostUsd + 
    queryEmbeddingCostUsd +
    totalDbCostUsd +
    retrievalPipelineCostUsd +
    rerankCostUsd +
    compressionCostUsd +
    totalLlmCostUsd +
    safetyCostUsd +
    totalInfraCostUsd +
    totalOpsCostUsd;

  const costPerQueryUsd = monthlyQueries > 0 ? (totalMonthlyRunningCostUsd / monthlyQueries) : 0;
  const costPerUserUsd = activeUsers > 0 ? (totalMonthlyRunningCostUsd / activeUsers) : 0;

  // Build vs Buy model details
  // Commercial API cost = totalMonthlyRunningCostUsd
  // Self-Hosted details:
  const selfHostedGpuCostUsd = inputs.infraGpuNodes > 0 
    ? gpuCost 
    : 1500.00; // default EC2 G5 instance or similar hosting for local models
  
  const selfHostedLlmOpsCostUsd = 2000.00; // DevOps + maintenance salary allocation
  const selfHostedTotalMonthlyUsd = selfHostedGpuCostUsd + selfHostedLlmOpsCostUsd + totalInfraCostUsd - serverCost; 
  
  return {
    currency: inputs.currency,
    multiplier: multiplier,
    
    // Ingestion
    totalPages,
    parsedPages,
    ocrPages,
    totalChunks: totalVectors,
    initialIndexSizeGb,
    initialDocProcessingCost: initialDocProcessingCostUsd * multiplier,
    initialEmbeddingCost: initialEmbeddingCostUsd * multiplier,
    totalInitialIngestionCost: totalInitialIngestionCostUsd * multiplier,
    
    // Monthly Components
    monthlyQueries,
    monthlyNewVectors,
    monthlyIndexGrowthGb,
    monthlyDocProcessingCost: monthlyDocProcessingCostUsd * multiplier,
    monthlyNewEmbeddingsCost: monthlyNewEmbeddingsCostUsd * multiplier,
    queryEmbeddingCost: queryEmbeddingCostUsd * multiplier,
    vectorDbCost: totalDbCostUsd * multiplier,
    retrievalCost: retrievalPipelineCostUsd * multiplier,
    rerankCost: rerankCostUsd * multiplier,
    compressionCost: compressionCostUsd * multiplier,
    llmInputCost: llmInputCostUsd * multiplier,
    llmOutputCost: llmOutputCostUsd * multiplier,
    totalLlmCost: totalLlmCostUsd * multiplier,
    safetyCost: safetyCostUsd * multiplier,
    infraCost: totalInfraCostUsd * multiplier,
    opsCost: totalOpsCostUsd * multiplier,
    
    // Build vs Buy comparisons
    commercialTotalMonthlyCost: totalMonthlyRunningCostUsd * multiplier,
    selfHostedTotalMonthlyCost: selfHostedTotalMonthlyUsd * multiplier,
    
    // Summary
    totalMonthlyCost: totalMonthlyRunningCostUsd * multiplier,
    totalAnnualCost: (totalMonthlyRunningCostUsd * 12 + totalInitialIngestionCostUsd) * multiplier,
    costPerQuery: costPerQueryUsd * multiplier,
    costPerUser: costPerUserUsd * multiplier
  };
}
