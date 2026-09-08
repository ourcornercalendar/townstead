"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { toast } from "sonner";
import { useOrg } from "@/hooks/use-org";
import { useDefaultYear } from "@/hooks/use-default-year";
import { useStableNow } from "@/hooks/use-stable-now";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StepForm, type Step } from "@/components/shared/step-form";
import { SelectEditionYear } from "../../new/steps/select-edition-year";
import {
  SelectAdTypes,
  type AdSelection,
} from "../../new/steps/select-ad-types";
import type { SlotAssignment } from "../../new/steps/assign-slots";
import {
  PaymentTermsStep,
  type PaymentTermsStepRef,
} from "../../new/steps/payment-terms-step";
import { ReviewConfirm } from "../../new/steps/review-confirm";
import type { PaymentTermsFormValues } from "@/lib/validators";
import { dollarsToCents, centsToDollars } from "@/lib/utils";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Lock, User } from "lucide-react";
import Link from "next/link";

function paymentTermsToCents(terms: PaymentTermsFormValues) {
  return {
    ...terms,
    totalSale: dollarsToCents(terms.totalSale),
    discount1: terms.discount1 != null ? dollarsToCents(terms.discount1) : undefined,
    discount2: terms.discount2 != null ? dollarsToCents(terms.discount2) : undefined,
    additionalSale1: terms.additionalSale1 != null ? dollarsToCents(terms.additionalSale1) : undefined,
    additionalSale2: terms.additionalSale2 != null ? dollarsToCents(terms.additionalSale2) : undefined,
    trade: terms.trade != null ? dollarsToCents(terms.trade) : undefined,
    earlyDiscountAmount:
      terms.earlyDiscountType === "flat" && terms.earlyDiscountAmount != null
        ? dollarsToCents(terms.earlyDiscountAmount)
        : terms.earlyDiscountAmount,
    lateFeeAmount:
      terms.lateFeeType === "flat" && terms.lateFeeAmount != null
        ? dollarsToCents(terms.lateFeeAmount)
        : terms.lateFeeAmount,
  };
}

function centsFieldToDollars(val: number | undefined): number | undefined {
  return val != null ? centsToDollars(val) : undefined;
}

const STEPS: Step[] = [
  { id: "contact", label: "Contact" },
  { id: "edition", label: "Edition & Year" },
  { id: "purchaseDetails", label: "Purchase Details" },
  { id: "terms", label: "Payment Terms" },
  { id: "review", label: "Review" },
];

interface EditFormState {
  contactId: Id<"contacts"> | null;
  contactLabel: string;
  calendarEditionIds: Id<"calendarEditions">[];
  editionNames: string[];
  year: number;
  adSelections: AdSelection[];
  slotAssignments: SlotAssignment[];
  paymentTerms: PaymentTermsFormValues;
}

export default function EditPurchasePage() {
  const params = useParams();
  const router = useRouter();
  const { orgId } = useOrg();
  const { defaultYear } = useDefaultYear();
  const id = params.id as Id<"purchases">;
  const now = useStableNow();

  const detail = useQuery(api.purchases.queries.getDetail, { id, now });
  const updatePurchase = useMutation(api.purchases.mutations.update);
  const paymentTermsRef = useRef<PaymentTermsStepRef>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const [formState, setFormState] = useState<EditFormState>({
    contactId: null,
    contactLabel: "",
    calendarEditionIds: [],
    editionNames: [],
    // Replaced by the purchase's own year once it loads; this is only what
    // the form holds for the moment before that.
    year: defaultYear,
    adSelections: [],
    slotAssignments: [],
    paymentTerms: {
      totalSale: 0,
      dueDayOfMonth: 1,
      splitEqually: true,
    },
  });

  useEffect(() => {
    if (detail && !initialized) {
      const contactLabel = detail.contact
        ? `${detail.contact.company ? detail.contact.company + " — " : ""}${detail.contact.firstName} ${detail.contact.lastName}`
        : "";

      const adSelections: AdSelection[] = detail.adPurchases.map((ap) => ({
        advertisementId: ap.advertisementId,
        calendarEditionId: ap.calendarEditionId,
        advertisementName: ap.advertisementName,
        isDayType: ap.isDayType,
        quantity: ap.quantity,
        charge: ap.charge != null ? centsToDollars(ap.charge) : undefined,
        slotsPerMonth: ap.slotsPerMonth,
      }));

      const slotAssignments: SlotAssignment[] = detail.adPurchases.flatMap(
        (ap) =>
          ap.slots
            .filter((s) => s.slotNumber != null)
            .map((s) => ({
              advertisementId: ap.advertisementId,
              calendarEditionId: ap.calendarEditionId,
              month: s.month,
              slotNumber: s.slotNumber ?? undefined,
              date: s.date ?? undefined,
            }))
      );

      const terms = detail.terms;
      const paymentTerms: PaymentTermsFormValues = {
        totalSale: centsToDollars(terms?.totalSale ?? 0),
        discount1: centsFieldToDollars(terms?.discount1),
        discount1Label: terms?.discount1Label ?? undefined,
        discount2: centsFieldToDollars(terms?.discount2),
        discount2Label: terms?.discount2Label ?? undefined,
        additionalSale1: centsFieldToDollars(terms?.additionalSale1),
        additionalSale1Label: terms?.additionalSale1Label ?? undefined,
        additionalSale2: centsFieldToDollars(terms?.additionalSale2),
        additionalSale2Label: terms?.additionalSale2Label ?? undefined,
        trade: centsFieldToDollars(terms?.trade),
        earlyDiscountType: terms?.earlyDiscountType ?? undefined,
        earlyDiscountAmount:
          terms?.earlyDiscountType === "flat"
            ? centsFieldToDollars(terms?.earlyDiscountAmount)
            : terms?.earlyDiscountAmount ?? undefined,
        lateFeeType: terms?.lateFeeType ?? undefined,
        lateFeeAmount:
          terms?.lateFeeType === "flat"
            ? centsFieldToDollars(terms?.lateFeeAmount)
            : terms?.lateFeeAmount ?? undefined,
        dueDayOfMonth: terms?.dueDayOfMonth ?? 1,
        splitEqually: terms?.splitEqually ?? true,
        deliveryMethod: terms?.deliveryMethod ?? undefined,
        invoiceMessage: terms?.invoiceMessage ?? undefined,
        statementMessage: terms?.statementMessage ?? undefined,
      };

      setFormState({
        contactId: detail.contactId,
        contactLabel,
        calendarEditionIds: detail.calendarEditionIds,
        editionNames: detail.editions.map((e) => `${e.name} (${e.code})`),
        year: detail.year,
        adSelections,
        slotAssignments,
        paymentTerms,
      });
      setCurrentStep(1);
      setInitialized(true);
    }
  }, [detail, initialized]);

  const canAdvance = useCallback(() => {
    switch (currentStep) {
      case 0:
        return formState.contactId !== null;
      case 1:
        return (
          formState.calendarEditionIds.length > 0 && formState.year >= 2000
        );
      case 2: {
        if (formState.adSelections.length === 0) return false;
        return formState.adSelections.every((ad) => {
          if (ad.slotsPerMonth === 0) return true;
          const matchingSlots = formState.slotAssignments.filter(
            (s) =>
              s.advertisementId === ad.advertisementId &&
              s.calendarEditionId === ad.calendarEditionId
          );
          return matchingSlots.length === ad.quantity;
        });
      }
      case 3:
        return formState.paymentTerms.totalSale > 0;
      case 4:
        return true;
      default:
        return false;
    }
  }, [currentStep, formState]);

  const handleNext = useCallback(async () => {
    if (currentStep === 3 && paymentTermsRef.current) {
      const validated = await paymentTermsRef.current.validate();
      if (!validated) return;
      setFormState((prev) => ({ ...prev, paymentTerms: validated }));
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, [currentStep]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (
      !orgId ||
      !formState.contactId ||
      formState.calendarEditionIds.length === 0
    )
      return;

    setIsSubmitting(true);
    try {
      const adSelections = formState.adSelections.map((sel) => ({
        advertisementId: sel.advertisementId,
        calendarEditionId: sel.calendarEditionId,
        quantity: sel.quantity,
        charge: sel.charge != null ? dollarsToCents(sel.charge) : undefined,
        slots: formState.slotAssignments
          .filter(
            (s) =>
              s.advertisementId === sel.advertisementId &&
              s.calendarEditionId === sel.calendarEditionId
          )
          .map((s) => ({
            month: s.month,
            slotNumber: s.slotNumber,
            date: s.date,
          })),
      }));

      const centTerms = paymentTermsToCents(formState.paymentTerms);
      const { splitEqually, dueDayOfMonth, ...restTerms } = centTerms;

      await updatePurchase({
        id,
        contactId: formState.contactId,
        calendarEditionIds: formState.calendarEditionIds,
        year: formState.year,
        adSelections,
        paymentTerms: {
          ...restTerms,
          splitEqually: splitEqually ?? true,
          dueDayOfMonth: dueDayOfMonth ?? 1,
        },
      });

      toast.success("Purchase updated");
      router.push(`/admin/purchases/${id}`);
    } catch {
      toast.error("Failed to update purchase");
    } finally {
      setIsSubmitting(false);
    }
  }, [orgId, formState, id, updatePurchase, router]);

  const handlePaymentTermsChange = useCallback(
    (values: PaymentTermsFormValues) => {
      setFormState((prev) => ({ ...prev, paymentTerms: values }));
    },
    []
  );

  if (detail === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="space-y-6">
        <Link href="/admin/purchases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Purchases
          </Button>
        </Link>
        <EmptyState
          title="Purchase not found"
          description="This purchase may have been deleted."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/purchases/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <PageHeader
        title={`Edit Purchase ${detail.invoiceNumber ?? ""}`}
        description="Modify purchase details, ad selections, and payment terms"
      />

      <StepForm
        steps={STEPS}
        currentStep={currentStep}
        onNext={handleNext}
        onBack={handleBack}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        canAdvance={canAdvance()}
        minStep={1}
      >
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <User className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Contact</h3>
                <p className="text-sm text-muted-foreground">
                  The contact for this purchase cannot be changed.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-4 py-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formState.contactLabel}</span>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <SelectEditionYear
            editionIds={formState.calendarEditionIds}
            year={formState.year}
            contactId={formState.contactId}
            excludePurchaseId={id}
            yearLocked
            onEditionsChange={(ids, names) =>
              setFormState((prev) => ({
                ...prev,
                calendarEditionIds: ids,
                editionNames: names,
              }))
            }
            onYearChange={(year) =>
              setFormState((prev) => ({ ...prev, year }))
            }
          />
        )}

        {currentStep === 2 && (
          <SelectAdTypes
            calendarEditionIds={formState.calendarEditionIds}
            editionNames={formState.editionNames}
            year={formState.year}
            selections={formState.adSelections}
            slotAssignments={formState.slotAssignments}
            onChange={(adSelections) =>
              setFormState((prev) => ({ ...prev, adSelections }))
            }
            onSlotsChange={(slotAssignments) =>
              setFormState((prev) => ({ ...prev, slotAssignments }))
            }
            purchaseId={id}
          />
        )}

        {currentStep === 3 && (
          <PaymentTermsStep
            ref={paymentTermsRef}
            values={formState.paymentTerms}
            onChange={handlePaymentTermsChange}
            suggestedTotal={0}
          />
        )}

        {currentStep === 4 && (
          <ReviewConfirm
            contactLabel={formState.contactLabel}
            calendarEditionIds={formState.calendarEditionIds}
            editionNames={formState.editionNames}
            year={formState.year}
            adSelections={formState.adSelections}
            slotAssignments={formState.slotAssignments}
            paymentTerms={formState.paymentTerms}
          />
        )}
      </StepForm>
    </div>
  );
}
