package org.dataland.datalandspecificationservice.configurations

import org.dataland.datalandspecification.database.SpecificationDatabase
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Component

/**
 * Reverse index from data point type id to the ids of the frameworks using it.
 * Built once from the specification database, which is only loaded at startup.
 */
@Component
class DataPointTypeUsageIndex(
    @Autowired database: SpecificationDatabase,
) {
    private val frameworkIdsByDataPointTypeId: Map<String, List<String>> =
        database.frameworks.values
            .sortedBy { it.id }
            .flatMap { framework ->
                framework.flattenedSchema
                    .mapNotNull { it.value }
                    .distinct()
                    .map { it to framework.id }
            }.groupBy({ it.first }, { it.second })

    /**
     * Get the ids of all frameworks using the given data point type, sorted by id.
     */
    fun getFrameworkIds(dataPointTypeId: String): List<String> = frameworkIdsByDataPointTypeId[dataPointTypeId] ?: emptyList()
}
