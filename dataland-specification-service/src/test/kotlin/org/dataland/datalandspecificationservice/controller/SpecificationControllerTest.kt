package org.dataland.datalandspecificationservice.controller

import org.dataland.datalandbackendutils.exceptions.ResourceNotFoundApiException
import org.dataland.datalandbackendutils.utils.JsonUtils.defaultObjectMapper
import org.dataland.datalandspecification.database.SpecificationDatabase
import org.dataland.datalandspecification.specifications.DataPointType
import org.dataland.datalandspecificationservice.DatalandSpecificationService
import org.dataland.datalandspecificationservice.model.toSummaryDto
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

/**
 * Test class for the SpecificationController.
 */
@SpringBootTest(
    classes = [DatalandSpecificationService::class],
    properties = ["dataland.specification-folder=res:/specifications-test"],
)
class SpecificationControllerTest(
    @Autowired val specificationController: SpecificationController,
) {
    @Test
    fun `retrieving a framework specification should return a DTO with correct refs and alias in schema`() {
        val response = specificationController.getFrameworkSpecification("test-framework")
        assert(response.statusCode.is2xxSuccessful)
        val schema = defaultObjectMapper.readTree(response.body!!.schema)
        assert(
            schema
                .path("test1")
                .path("test2")
                .path("test3")
                .path("ref")
                .textValue() ==
                "https://local-dev.dataland.com/specifications/data-point-types/test-datapoint-type",
        )
        assert(
            schema
                .path("test1")
                .path("test2")
                .path("test3")
                .path("aliasExport")
                .textValue() ==
                "alias",
        )
    }

    @Test
    fun `retrieving a data point specification should return a DTO with correct refs in usedBy`() {
        val response = specificationController.getDataPointTypeSpecification("test-datapoint-type")
        assert(response.statusCode.is2xxSuccessful)
        val body = response.body!!
        assert(body.usedBy[0].ref == "https://local-dev.dataland.com/specifications/frameworks/test-framework")
    }

    @Test
    fun `retrieving a data point type specification should return a DTO with correct refs in usedBy`() {
        val response = specificationController.getDataPointBaseType("test-datapoint-base-type")
        assert(response.statusCode.is2xxSuccessful)
        val body = response.body!!
        assert(body.usedBy.any { it.ref == "https://local-dev.dataland.com/specifications/data-point-types/test-datapoint-type" })
    }

    @Test
    fun `retrieving a non existing framework specification should return 404`() {
        assertThrows<ResourceNotFoundApiException> {
            specificationController.getFrameworkSpecification("non-existing-framework")
        }
    }

    @Test
    fun `retrieving a non existing data point specification should return 404`() {
        assertThrows<ResourceNotFoundApiException> {
            specificationController.getDataPointTypeSpecification("non-existing-datapoint")
        }
    }

    @Test
    fun `retrieving a non existing data point type specification should return 404`() {
        assertThrows<ResourceNotFoundApiException> {
            specificationController.getDataPointBaseType("non-existing-datapoint-type")
        }
    }

    @Test
    fun `returning schema for known base type`() {
        val frameworkSpecificationId = "test-framework"
        val response = specificationController.getResolvedFrameworkSpecification(frameworkSpecificationId)
        assert(response.statusCode.is2xxSuccessful)
        assert(response.body?.resolvedSchema.toString() == "{test1={test2={test3={\"testing\":\"Boolean\"}}}}")
    }

    @Test
    fun `listing data point types returns all types sorted by name and id`() {
        val body = specificationController.listDataPointTypeSpecifications().body!!
        val ids = body.map { it.dataPointType.id }
        assert(ids == listOf("shared-datapoint-type", "test-datapoint-type", "unused-datapoint-type"))
    }

    @Test
    fun `listing data point types computes usedBy for several, one and no frameworks`() {
        val body = specificationController.listDataPointTypeSpecifications().body!!.associateBy { it.dataPointType.id }
        assert(body.getValue("shared-datapoint-type").usedBy.map { it.id } == listOf("shared-framework-a", "shared-framework-b"))
        assert(body.getValue("test-datapoint-type").usedBy.map { it.id } == listOf("test-framework"))
        assert(body.getValue("unused-datapoint-type").usedBy.isEmpty())
    }

    @Test
    fun `list summaries match the detail responses`() {
        specificationController.listDataPointTypeSpecifications().body!!.forEach { summary ->
            val detail = specificationController.getDataPointTypeSpecification(summary.dataPointType.id).body!!
            assert(summary.dataPointType == detail.dataPointType)
            assert(summary.name == detail.name)
            assert(summary.businessDefinition == detail.businessDefinition)
            assert(summary.dataPointBaseType == detail.dataPointBaseType)
            assert(summary.usedBy.toSet() == detail.usedBy.toSet())
        }
    }

    @Test
    fun `creating a summary for a data point type with a missing base type fails`() {
        val emptyDatabase = object : SpecificationDatabase() {}
        val dataPointType =
            DataPointType(
                id = "orphan",
                name = "Orphan",
                businessDefinition = "Orphan",
                dataPointBaseTypeId = "missing-base-type",
                frameworkOwnership = emptySet(),
            )
        assertThrows<IllegalStateException> {
            dataPointType.toSummaryDto("local-dev.dataland.com", emptyDatabase, emptyList())
        }
    }
}
