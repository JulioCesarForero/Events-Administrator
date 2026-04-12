"""Unit tests for camelCase serialization."""

from uuid import uuid4

from shared.api.schemas import CamelModel, CamelOrmModel


class TestCamelModel:
    def test_serializes_to_camel_case(self):
        class Sample(CamelModel):
            first_name: str
            last_name: str

        obj = Sample(first_name="Juan", last_name="Perez")
        data = obj.model_dump(by_alias=True)
        assert "firstName" in data
        assert "lastName" in data
        assert data["firstName"] == "Juan"

    def test_accepts_snake_case_input(self):
        class Sample(CamelModel):
            event_id: str

        obj = Sample(event_id="abc")
        assert obj.event_id == "abc"

    def test_accepts_camel_case_input(self):
        class Sample(CamelModel):
            event_id: str

        obj = Sample.model_validate({"eventId": "abc"})
        assert obj.event_id == "abc"


class TestCamelOrmModel:
    def test_from_attributes(self):
        class Row:
            first_name = "Juan"
            last_name = "Perez"

        class Sample(CamelOrmModel):
            first_name: str
            last_name: str

        obj = Sample.model_validate(Row())
        data = obj.model_dump(by_alias=True)
        assert data["firstName"] == "Juan"
