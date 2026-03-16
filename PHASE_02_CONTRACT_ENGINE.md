# Phase 2 — Contract Engine

Goal

Create the rent-to-own agreement system.

## Components

- Contracts collection
- Contract creation API
- Payment frequency rules

## States

- ACTIVE
- DELINQUENT
- DEFAULTED
- COMPLETED

## Rules

- Contracts must link to a vehicle
- Vehicles cannot have multiple active contracts

## Verification

System double checks:

- Vehicle availability
- Contract ownership mapping
- Payment schedule validity
