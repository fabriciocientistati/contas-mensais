using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContasMensais.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCamposContaVencimento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DataVencimento",
                table: "Contas",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<int>(
                name: "QuantidadeParcelas",
                table: "Contas",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "ValorParcela",
                table: "Contas",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DataVencimento",
                table: "Contas");

            migrationBuilder.DropColumn(
                name: "QuantidadeParcelas",
                table: "Contas");

            migrationBuilder.DropColumn(
                name: "ValorParcela",
                table: "Contas");
        }
    }
}
