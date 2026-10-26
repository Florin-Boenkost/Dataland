package org.dataland.datalandspecificationservice.model

import org.dataland.datalandspecification.database.SpecificationDatabase
import org.dataland.datalandspecification.specifications.DataPointType

/**
 * Create a data point type summary DTO using a precomputed list of frameworks using the data point type.
 */
fun DataPointType.toSummaryDto(
    baseUrl: String,
    database: SpecificationDatabase,
    usedBy: List<IdWithRef>,
): DataPointTypeSummary =
    DataPointTypeSummary(
        dataPointType = this.getRef(baseUrl),
        name = this.name,
        businessDefinition = this.businessDefinition,
        dataPointBaseType =
            database.dataPointBaseTypes[this.dataPointBaseTypeId]?.getRef(
                baseUrl,
            ) ?: error("Data point base type ${this.dataPointBaseTypeId} does not exist in the database."),
        usedBy = usedBy,
    )

/**
 * Lightweight DTO for a data point type specification, used in list responses.
 */
data class DataPointTypeSummary(
    val dataPointType: IdWithRef,
    val name: String,
    val businessDefinition: String,
    val dataPointBaseType: IdWithRef,
    val usedBy: List<IdWithRef>,
)
